// File: src/lib/services/fleet.ts
// (REPLACE the whole file)

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import {
  createDocument,
  createMonthlyCheck,
  createPreTrip,
  createRoadside,
  createWash,
  getChecklist,
  getTripBlocks,
  getTruck,
  getTruckBlocks,
  getUserById,
} from "@/lib/data";
import {
  documentSchema,
  monthlyCheckSchema,
  preTripServerSchema,
  roadsideSchema,
  toPathErrors,
  washServerSchema,
} from "@/lib/validation/fleet";
import { isFleetPathFor } from "@/lib/evidence/paths";
import {
  sendDoNotDriveAlert,
  sendMonthlyCheckAlert,
  sendPreTripNoAlert,
} from "@/lib/email/alerts";
import { MONTHLY_CHECK_ITEMS, ticketItemLabel, type User } from "@/types";

export type FleetServiceResult =
  | { ok: true; id: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

function refresh() {
  revalidatePath("/driver", "layout");
  revalidatePath("/admin", "layout");
}

function fail(err: unknown): FleetServiceResult {
  console.error(err);
  return { ok: false, error: "Couldn't save. Please try again." };
}

/** Used by the online form and by offline sync */
export async function createPreTripFor(
  user: User,
  raw: unknown,
  opts: { offline?: boolean } = {},
): Promise<FleetServiceResult> {
  const parsed = preTripServerSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, fieldErrors: toPathErrors(parsed.error) };
  const d = parsed.data;

  const truck = await getTruck(d.truckId);
  if (!truck || !truck.active)
    return { ok: false, fieldErrors: { truckId: "Choose an active truck" } };

  // Expired documents or a trip hold stop a new pre-trip (a check already done offline still saves)
  if (!opts.offline) {
    const [truckBlocks, tripBlocks] = await Promise.all([
      getTruckBlocks([truck.id]),
      getTripBlocks(user.id),
    ]);
    const reasons = truckBlocks[truck.id];
    if (reasons?.length)
      return {
        ok: false,
        fieldErrors: {
          truckId: `Unit ${truck.unitNumber} can't be used: ${reasons.join(". ")}`,
        },
      };
    const driverDoc = tripBlocks.find((b) => b.kind === "driver_doc");
    if (driverDoc) return { ok: false, error: driverDoc.message };
  }

  // Every file must be in this driver's own folder
  const washPaths = d.washed
    ? [d.washPhoto, d.washReceipt].filter((p): p is string => !!p)
    : [];
  const paths = [
    d.signature,
    ...d.items.flatMap((i) => i.photos),
    ...Object.values(d.conditionPhotos),
    ...washPaths,
  ];
  if (!paths.every((p) => isFleetPathFor(p, "pre_trip", user.id))) {
    return {
      ok: false,
      error: "Photos didn't upload correctly. Please try again.",
    };
  }

  try {
    const rec = await createPreTrip({
      truckId: truck.id,
      driverId: user.id,
      items: d.items.map((i) => ({ ...i, notes: i.notes || undefined })),
      conditionPhotos: d.conditionPhotos,
      washed: d.washed,
      washPhotoPath: d.washed ? (d.washPhoto ?? null) : null,
      washReceiptPath: d.washed ? (d.washReceipt ?? null) : null,
      odometer: d.odometer,
      truckStatus: d.truckStatus,
      notes: d.notes || undefined,
      signaturePath: d.signature,
      capturedAtDevice: d.capturedAtDevice,
      lat: d.lat,
      lng: d.lng,
      syncedOffline: !!opts.offline,
    });
    const noItems = d.items.filter((i) => i.status === "attention");
    if (noItems.length) {
      // Admins hear about every "No" right away (after the response is sent)
      after(async () => {
        const rules = await getChecklist().catch(() => []);
        const rule = (k: string) => rules.find((r) => r.key === k);
        await sendPreTripNoAlert({
          preTripId: rec.id,
          unitNumber: truck.unitNumber,
          driverName: user.name,
          items: noItems.map((i) => ({
            label: rule(i.key)?.label ?? ticketItemLabel(i.key),
            notes: i.notes || undefined,
            blocks: !!rule(i.key)?.blocksTrip,
          })),
          photoPaths: noItems.flatMap((i) => i.photos),
        });
      });
    }
    if (d.truckStatus === "do_not_drive") {
      // Email the admins after the response is sent (never slows down or fails the save)
      after(() =>
        sendDoNotDriveAlert({
          preTripId: rec.id,
          unitNumber: truck.unitNumber,
          driverName: user.name,
          odometer: d.odometer,
          failedItems: d.items
            .filter((i) => i.status === "attention")
            .map((i) => ({ key: i.key, notes: i.notes || undefined })),
          notes: d.notes || undefined,
        }),
      );
    }
    refresh();
    return { ok: true, id: rec.id };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Drivers log their own inspections. Admins choose the driver.
 * The report file was uploaded by whoever is logging it.
 */
export async function createRoadsideFor(
  user: User,
  raw: unknown,
): Promise<FleetServiceResult> {
  const parsed = roadsideSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, fieldErrors: toPathErrors(parsed.error) };
  const d = parsed.data;

  let driverId = user.id;
  if (user.role === "admin") {
    const driver = d.driverId ? await getUserById(d.driverId) : null;
    if (!driver || driver.role !== "driver")
      return { ok: false, fieldErrors: { driverId: "Choose a driver" } };
    driverId = driver.id;
  }

  const truck = await getTruck(d.truckId);
  if (!truck) return { ok: false, fieldErrors: { truckId: "Choose a truck" } };

  if (d.report && !isFleetPathFor(d.report.path, "roadside", user.id)) {
    return {
      ok: false,
      error: "The report didn't upload correctly. Please try again.",
    };
  }

  try {
    const rec = await createRoadside({
      driverId,
      truckId: truck.id,
      date: d.date,
      state: d.state,
      location: d.location,
      result: d.result,
      violationNotes: d.violationNotes || undefined,
      report: d.report,
    });
    refresh();
    return { ok: true, id: rec.id };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Old separate "Mark truck washed" form. Washes are now logged inside the pre-trip;
 * this stays only so washes already saved offline on a phone still upload.
 */
export async function createWashFor(
  user: User,
  raw: unknown,
  opts: { offline?: boolean } = {},
): Promise<FleetServiceResult> {
  const parsed = washServerSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, fieldErrors: toPathErrors(parsed.error) };
  const d = parsed.data;

  const truck = await getTruck(d.truckId);
  if (!truck || !truck.active)
    return { ok: false, fieldErrors: { truckId: "Choose an active truck" } };

  const paths = [d.photo, ...(d.receipt ? [d.receipt] : [])];
  if (!paths.every((p) => isFleetPathFor(p, "wash", user.id))) {
    return {
      ok: false,
      error: "Photos didn't upload correctly. Please try again.",
    };
  }

  try {
    const rec = await createWash({
      truckId: truck.id,
      driverId: user.id,
      photoPath: d.photo,
      receiptPath: d.receipt ?? null,
      notes: d.notes || undefined,
      capturedAtDevice: d.capturedAtDevice,
      lat: d.lat,
      lng: d.lng,
      syncedOffline: !!opts.offline,
    });
    refresh();
    return { ok: true, id: rec.id };
  } catch (err) {
    return fail(err);
  }
}

/* =========================================================
   Roadside readiness
   ========================================================= */

/** Truck documents (admins) and driver documents (the driver, or an admin for them) */
export async function createDocumentFor(
  user: User,
  raw: unknown,
): Promise<FleetServiceResult> {
  const parsed = documentSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, fieldErrors: toPathErrors(parsed.error) };
  const d = parsed.data;
  const driverDoc = d.docType === "medical_card" || d.docType === "license";

  let truckId: string | undefined;
  let driverId: string | undefined;
  if (driverDoc) {
    driverId = user.role === "admin" ? d.driverId : user.id;
    const driver = driverId ? await getUserById(driverId) : null;
    if (!driver || driver.role !== "driver")
      return { ok: false, error: "Driver not found." };
  } else {
    if (user.role !== "admin")
      return { ok: false, error: "Only an admin can upload truck documents." };
    const truck = d.truckId ? await getTruck(d.truckId) : null;
    if (!truck) return { ok: false, error: "Truck not found." };
    truckId = truck.id;
  }

  if (!d.files.every((f) => isFleetPathFor(f.path, "docs", user.id)))
    return {
      ok: false,
      error: "The file didn't upload correctly. Please try again.",
    };

  try {
    const rec = await createDocument({
      truckId,
      driverId,
      docType: d.docType,
      title: d.title || undefined,
      files: d.files,
      expiresOn: d.expiresOn,
    });
    refresh();
    return { ok: true, id: rec.id };
  } catch (err) {
    return fail(err);
  }
}

/** Monthly truck check: 3 items, a photo each. A "No" emails the admins. */
export async function createMonthlyCheckFor(
  user: User,
  raw: unknown,
): Promise<FleetServiceResult> {
  const parsed = monthlyCheckSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, fieldErrors: toPathErrors(parsed.error) };
  const d = parsed.data;

  const truck = await getTruck(d.truckId);
  if (!truck || !truck.active)
    return { ok: false, fieldErrors: { truckId: "Choose an active truck" } };

  const defs = MONTHLY_CHECK_ITEMS;
  if (
    d.items.length !== defs.length ||
    !defs.every((def) => d.items.some((i) => i.key === def.key))
  )
    return { ok: false, error: "Please answer every item." };
  if (!d.items.every((i) => isFleetPathFor(i.photo, "monthly", user.id)))
    return {
      ok: false,
      error: "Photos didn't upload correctly. Please try again.",
    };

  const items = defs.map((def) => {
    const it = d.items.find((i) => i.key === def.key)!;
    return { ...it, label: def.label, notes: it.notes || undefined };
  });

  try {
    const rec = await createMonthlyCheck({
      truckId: truck.id,
      driverId: user.id,
      items,
      notes: d.notes || undefined,
      capturedAtDevice: d.capturedAtDevice,
      lat: d.lat,
      lng: d.lng,
    });
    const no = items.filter((i) => i.status === "attention");
    if (no.length) {
      after(() =>
        sendMonthlyCheckAlert({
          checkId: rec.id,
          truckId: truck.id,
          unitNumber: truck.unitNumber,
          driverName: user.name,
          items: no.map((i) => ({ label: i.label, notes: i.notes })),
        }),
      );
    }
    refresh();
    return { ok: true, id: rec.id };
  } catch (err) {
    return fail(err);
  }
}
