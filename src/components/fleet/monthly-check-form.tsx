// File: src/components/fleet/monthly-check-form.tsx
// (NEW file)

"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import {
  Field,
  FormError,
  FormSection,
  NativeSelect,
  TEXTAREA_CLASS,
} from "@/components/driver/form-bits";
import { FormActions } from "@/components/driver/form-actions";
import { PhotoSlot } from "./photo-slot";
import { useGeolocation } from "@/hooks/use-geolocation";
import { createMonthlyCheckAction } from "@/app/(driver)/driver/fleet-actions";
import {
  OfflineUploadError,
  UploadRejectedError,
  uploadFleetPhoto,
} from "@/lib/evidence/upload";
import { MONTHLY_CHECK_ITEMS, type CheckStatus } from "@/types";
import { cn } from "@/lib/utils";

type ItemState = {
  status: CheckStatus | "";
  notes: string;
  photo: string | null;
};

/** Monthly truck check: 3 items, a photo of each (needs signal) */
export function MonthlyCheckForm({
  trucks,
  defaultTruckId,
  usdot,
}: {
  trucks: { id: string; unitNumber: string }[];
  defaultTruckId?: string;
  usdot?: string;
}) {
  const geo = useGeolocation();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [truckId, setTruckId] = useState(defaultTruckId ?? "");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(
      MONTHLY_CHECK_ITEMS.map((i) => [
        i.key,
        { status: "", notes: "", photo: null },
      ]),
    ),
  );

  const setItem = (key: string, patch: Partial<ItemState>) =>
    setItems((s) => ({ ...s, [key]: { ...s[key], ...patch } }));
  const clear = (k: string) =>
    errors[k] && setErrors((e) => ({ ...e, [k]: "" }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(undefined);

    // Check on the phone first
    const errs: Record<string, string> = {};
    if (!truckId) errs.truckId = "Choose a truck";
    MONTHLY_CHECK_ITEMS.forEach((def, i) => {
      const it = items[def.key];
      if (!it.status) errs[`items.${i}.status`] = "Answer Yes or No";
      if (!it.photo) errs[`items.${i}.photo`] = "Add the photo";
      if (it.status === "attention" && !it.notes.trim())
        errs[`items.${i}.notes`] = "Describe the problem";
    });
    if (Object.keys(errs).length) {
      setErrors(errs);
      setFormError("Please fix the highlighted parts.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    startTransition(async () => {
      try {
        const key = crypto.randomUUID();
        const uploaded = [];
        for (const def of MONTHLY_CHECK_ITEMS) {
          const it = items[def.key];
          uploaded.push({
            key: def.key,
            status: it.status as CheckStatus,
            notes: it.notes.trim() || undefined,
            photo: await uploadFleetPhoto(
              "monthly",
              `${key}-${def.key}`,
              it.photo!,
            ),
          });
        }
        const res = await createMonthlyCheckAction({
          truckId,
          items: uploaded,
          notes: notes.trim() || undefined,
          capturedAtDevice: new Date().toISOString(),
          lat: geo.lat,
          lng: geo.lng,
        });
        if (res?.fieldErrors) {
          setErrors(res.fieldErrors);
          setFormError("Please fix the highlighted parts.");
        } else if (res?.error) setFormError(res.error);
      } catch (err) {
        if (err instanceof OfflineUploadError)
          setFormError(
            "No signal. The monthly check needs signal to upload the photos. Try again soon.",
          );
        else if (err instanceof UploadRejectedError) setFormError(err.message);
        else throw err;
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <FormError message={formError} />

      <FormSection title="Truck">
        <Field label="Unit number" error={errors.truckId}>
          <NativeSelect
            value={truckId}
            onChange={(e) => {
              setTruckId(e.target.value);
              clear("truckId");
            }}
            aria-invalid={!!errors.truckId}
          >
            <option value="">Choose the truck</option>
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>
                Unit {t.unitNumber}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </FormSection>

      <FormSection
        title="Monthly check"
        description='Take one photo for each item. A "No" alerts the admins.'
      >
        <div className="space-y-3">
          {MONTHLY_CHECK_ITEMS.map((def, i) => {
            const it = items[def.key];
            return (
              <div
                key={def.key}
                className={cn(
                  "rounded-xl border bg-white p-4",
                  it.status === "attention" &&
                    "border-amber-300 bg-amber-50/40",
                  it.status === "ok" && "border-green-200",
                  errors[`items.${i}.status`] && "border-destructive",
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      <span className="mr-1.5 text-muted-foreground">
                        {i + 1}.
                      </span>
                      {def.label}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {def.key === "dot_markings" && usdot
                        ? `USDOT ${usdot}. `
                        : ""}
                      {def.hint}
                    </p>
                  </div>
                  <div className="flex gap-2 sm:shrink-0">
                    {(["ok", "attention"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          setItem(def.key, { status: v });
                          clear(`items.${i}.status`);
                        }}
                        className={cn(
                          "flex h-12 flex-1 items-center justify-center gap-1.5 rounded-lg border px-6 text-[15px] font-semibold transition sm:flex-none",
                          it.status === v
                            ? v === "ok"
                              ? "border-green-600 bg-green-600 text-white"
                              : "border-amber-500 bg-amber-500 text-white"
                            : "bg-white text-foreground/80 hover:border-foreground/30",
                        )}
                      >
                        {v === "ok" ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                        {v === "ok" ? "Yes" : "No"}
                      </button>
                    ))}
                  </div>
                </div>
                {errors[`items.${i}.status`] && (
                  <p className="mt-2 text-sm font-medium text-destructive">
                    {errors[`items.${i}.status`]}
                  </p>
                )}
                <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-[200px_minmax(0,1fr)]">
                  <div>
                    <PhotoSlot
                      label="Photo"
                      value={it.photo}
                      invalid={!!errors[`items.${i}.photo`]}
                      onChange={(p) => {
                        setItem(def.key, { photo: p });
                        clear(`items.${i}.photo`);
                      }}
                    />
                    {errors[`items.${i}.photo`] && (
                      <p className="mt-1.5 text-sm font-medium text-destructive">
                        {errors[`items.${i}.photo`]}
                      </p>
                    )}
                  </div>
                  {it.status === "attention" && (
                    <Field
                      label="What's wrong?"
                      htmlFor={`m-${def.key}`}
                      error={errors[`items.${i}.notes`]}
                    >
                      <textarea
                        id={`m-${def.key}`}
                        value={it.notes}
                        onChange={(e) => {
                          setItem(def.key, { notes: e.target.value });
                          clear(`items.${i}.notes`);
                        }}
                        aria-invalid={!!errors[`items.${i}.notes`]}
                        className={TEXTAREA_CLASS}
                      />
                    </Field>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <Field label="Other notes" htmlFor="m-notes" optional>
          <textarea
            id="m-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={TEXTAREA_CLASS}
          />
        </Field>
      </FormSection>

      <FormActions cancelHref="/driver/pre-trip" pending={pending}>
        Submit monthly check
      </FormActions>
    </form>
  );
}
