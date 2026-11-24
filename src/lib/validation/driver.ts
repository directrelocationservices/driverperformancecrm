// File: src/lib/validation/driver.ts
// (REPLACE the whole file)

import { z } from "zod";
import { MAX_PHOTOS } from "@/lib/constants";

export function toFieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export const jobSchema = z.object({
  jobNumber: z.string().trim().min(1, "Job number is required").max(40),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Select a date"),
  originCity: z.string().trim().min(1, "Origin city is required"),
  originState: z.string().length(2, "Select a state"),
  destCity: z.string().trim().min(1, "Destination city is required"),
  destState: z.string().length(2, "Select a state"),
  crewIds: z.array(z.string()),
  deliveredBy: z.enum(["drs", "partner"]),
  onTimePickup: z.boolean().nullable(),
  onTimeDelivery: z.boolean().nullable(),
});
export type NewJobInput = z.infer<typeof jobSchema>;

export const preDamageSchema = z.object({
  jobId: z.string().min(1),
  item: z.string().trim().min(1, "Item is required").max(120),
  location: z.string().trim().min(1, "Location on item is required").max(120),
  description: z.string().trim().min(1, "Describe the damage").max(1000),
  photos: z
    .array(z.string().startsWith("data:image/"))
    .min(1, "Add at least 1 photo")
    .max(MAX_PHOTOS, `Maximum ${MAX_PHOTOS} photos`),
  notes: z.string().trim().max(1000).optional(),
  customerShown: z
    .boolean()
    .refine((v) => v, "Confirm the customer was shown the damage"),
  customerName: z
    .string()
    .trim()
    .min(2, "Customer printed name is required")
    .max(120),
  signature: z
    .string()
    .startsWith("data:image/", "Customer signature is required"),
  capturedAtDevice: z.string().min(1),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
});
export type PreDamageInput = z.infer<typeof preDamageSchema>;

export const damageSchema = z.object({
  jobId: z.string().min(1),
  item: z.string().trim().min(1, "Item is required").max(120),
  description: z.string().trim().min(1, "Describe what happened").max(1000),
  photos: z
    .array(z.string().startsWith("data:image/"))
    .min(1, "Add at least 1 photo")
    .max(MAX_PHOTOS, `Maximum ${MAX_PHOTOS} photos`),
  claimFiled: z.boolean({ message: "Select yes or no" }),
  estimatedCost: z
    .number({ message: "Enter an estimated cost" })
    .min(0, "Cost can't be negative")
    .max(1_000_000),
});
export type DamageInput = z.infer<typeof damageSchema>;

export const reviewSchema = z
  .object({
    jobId: z.string().min(1),
    platform: z.enum(["google", "bbb", "trustpilot", "facebook", "other"], {
      message: "Select a platform",
    }),
    stars: z.number().int().min(1, "Select a star rating").max(5),
    driverMentioned: z.boolean({ message: "Select yes or no" }),
    link: z
      .string()
      .trim()
      .url("Enter a valid link")
      .optional()
      .or(z.literal("")),
    screenshot: z
      .string()
      .startsWith("data:image/")
      .optional()
      .or(z.literal("")),
  })
  .refine((d) => !!d.link || !!d.screenshot, {
    message: "Add a link or a screenshot",
    path: ["link"],
  });
export type ReviewInput = z.infer<typeof reviewSchema>;

export const upsellSchema = z.object({
  jobId: z.string().min(1),
  type: z.enum(["packing", "storage", "materials", "other"], {
    message: "Select an upsell type",
  }),
  amount: z
    .number({ message: "Enter an amount" })
    .positive("Amount must be more than $0")
    .max(1_000_000),
});
export type UpsellInput = z.infer<typeof upsellSchema>;

export const onTimeSchema = z.object({
  jobId: z.string().min(1),
  field: z.enum(["pickup", "delivery"]),
  value: z.boolean(),
});
export type OnTimeInput = z.infer<typeof onTimeSchema>;

/* ---------- Server-side versions (images already uploaded to storage) ---------- */
const storagePath = z.string().min(1).max(300);

export const preDamageServerSchema = preDamageSchema.extend({
  photos: z
    .array(storagePath)
    .min(1, "Add at least 1 photo")
    .max(MAX_PHOTOS, `Maximum ${MAX_PHOTOS} photos`),
  signature: storagePath,
});
export type PreDamageServerInput = z.infer<typeof preDamageServerSchema>;

export const damageServerSchema = damageSchema.extend({
  photos: z
    .array(storagePath)
    .min(1, "Add at least 1 photo")
    .max(MAX_PHOTOS, `Maximum ${MAX_PHOTOS} photos`),
});
export type DamageServerInput = z.infer<typeof damageServerSchema>;

export const reviewServerSchema = z
  .object({
    jobId: z.string().min(1),
    platform: z.enum(["google", "bbb", "trustpilot", "facebook", "other"], {
      message: "Select a platform",
    }),
    stars: z.number().int().min(1, "Select a star rating").max(5),
    driverMentioned: z.boolean({ message: "Select yes or no" }),
    link: z
      .string()
      .trim()
      .url("Enter a valid link")
      .optional()
      .or(z.literal("")),
    screenshot: storagePath.optional().or(z.literal("")),
  })
  .refine((d) => !!d.link || !!d.screenshot, {
    message: "Add a link or a screenshot",
    path: ["link"],
  });
export type ReviewServerInput = z.infer<typeof reviewServerSchema>;

/* ---------- Admin damage reports ---------- */
export const DAMAGE_SOURCES = [
  "customer_call",
  "claim",
  "inspection",
  "other",
] as const;

const adminDamageBase = {
  jobId: z.string().min(1, "Enter a job number from this driver's jobs"),
  damageDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Select a date"),
  source: z.enum(DAMAGE_SOURCES, { message: "Select where this came from" }),
  item: z.string().trim().min(1, "Item is required").max(120),
  description: z.string().trim().min(1, "Describe what happened").max(1000),
  claimFiled: z.boolean({ message: "Select yes or no" }),
  estimatedCost: z
    .number({ message: "Enter an estimated cost" })
    .min(0, "Cost can't be negative")
    .max(1_000_000),
};

/** Customer service damage: up to 10 photos */
export const MAX_ADMIN_DAMAGE_PHOTOS = 10;

const csDamageFields = {
  reportedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Select the date reported"),
  reportedBy: z.string().min(1, "Select who took the report"),
  attributedTo: z.enum(["pickup", "delivery", "carrier"], {
    message: "Choose who it's attributed to",
  }),
  attributedDriverId: z.string().optional(),
  carrierId: z.string().optional(),
};

function checkAttribution(
  d: { attributedTo: string; attributedDriverId?: string; carrierId?: string },
  ctx: z.RefinementCtx,
) {
  if (d.attributedTo === "carrier" && !d.carrierId)
    ctx.addIssue({
      code: "custom",
      path: ["carrierId"],
      message: "Choose the carrier",
    });
  if (d.attributedTo !== "carrier" && !d.attributedDriverId)
    ctx.addIssue({
      code: "custom",
      path: ["attributedDriverId"],
      message: "Choose the driver",
    });
}

export const adminDamageSchema = z
  .object({
    ...adminDamageBase,
    ...csDamageFields,
    photos: z
      .array(z.string().startsWith("data:image/"))
      .max(
        MAX_ADMIN_DAMAGE_PHOTOS,
        `Maximum ${MAX_ADMIN_DAMAGE_PHOTOS} photos`,
      ),
  })
  .superRefine(checkAttribution);

export const adminDamageServerSchema = z
  .object({
    ...adminDamageBase,
    ...csDamageFields,
    photos: z
      .array(storagePath)
      .max(
        MAX_ADMIN_DAMAGE_PHOTOS,
        `Maximum ${MAX_ADMIN_DAMAGE_PHOTOS} photos`,
      ),
  })
  .superRefine(checkAttribution);

export const damageCorrectionSchema = z.object({
  id: z.string().min(1),
  item: adminDamageBase.item,
  description: adminDamageBase.description,
  damageDate: adminDamageBase.damageDate.nullable(),
  source: z.enum(["driver", ...DAMAGE_SOURCES]),
  claimFiled: z.boolean(),
  estimatedCost: adminDamageBase.estimatedCost,
  reason: z
    .string()
    .trim()
    .min(3, "Give a reason for this correction")
    .max(500),
});
export type DamageCorrectionInput = z.infer<typeof damageCorrectionSchema>;

export const damageNoteServerSchema = z.object({
  damageId: z.string().min(1),
  jobId: z.string().min(1),
  note: z.string().trim().min(1, "Write a note").max(2000),
  photos: z.array(storagePath).max(MAX_PHOTOS, `Maximum ${MAX_PHOTOS} photos`),
});
/* ---------- Jobs entered by the office ---------- */
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Select a date");

export const adminJobSchema = z
  .object({
    id: z.string().optional(),
    driverId: z.string().min(1, "Select the driver"),
    crewIds: z.array(z.string()).max(20),
    jobNumber: z.string().trim().min(1, "Job number is required").max(40),
    customerName: z.string().trim().max(120).optional(),
    date: day,
    deliveryDate: day.optional().or(z.literal("")),
    originCity: z.string().trim().min(1, "Origin city is required").max(80),
    originState: z.string().length(2, "Select a state"),
    destCity: z.string().trim().min(1, "Destination city is required").max(80),
    destState: z.string().length(2, "Select a state"),
    deliveredBy: z.enum(["drs", "partner"]),
    carrierId: z.string().optional().or(z.literal("")),
    onTimePickup: z.boolean().nullable(),
    onTimeDelivery: z.boolean().nullable(),
  })
  .refine((d) => !d.deliveryDate || d.deliveryDate >= d.date, {
    path: ["deliveryDate"],
    message: "Delivery can't be before the pickup date",
  });
export type AdminJobInput = z.infer<typeof adminJobSchema>;

const officePreDamageBase = {
  jobId: z.string().min(1),
  item: z.string().trim().min(1, "Item is required").max(120),
  location: z.string().trim().min(1, "Location on item is required").max(120),
  description: z.string().trim().min(1, "Describe the damage").max(1000),
  notes: z.string().trim().max(1000).optional(),
  customerName: z.string().trim().min(2, "Customer name is required").max(120),
  customerShown: z.boolean(),
};
export const officePreDamageSchema = z.object({
  ...officePreDamageBase,
  photos: z
    .array(z.string().startsWith("data:image/"))
    .min(1, "Add at least 1 photo")
    .max(MAX_PHOTOS, `Maximum ${MAX_PHOTOS} photos`),
});
export const officePreDamageServerSchema = z.object({
  ...officePreDamageBase,
  photos: z
    .array(storagePath)
    .min(1, "Add at least 1 photo")
    .max(MAX_PHOTOS, `Maximum ${MAX_PHOTOS} photos`),
});

export const jobDocumentsSchema = z.object({
  jobId: z.string().min(1),
  files: z
    .array(
      z.object({
        kind: z.enum(["photo", "paperwork", "other"]),
        path: z.string(),
        name: z.string().trim().min(1).max(200),
      }),
    )
    .min(1, "Choose at least one file")
    .max(20, "Up to 20 files at a time"),
});

/* ---------- Offload ---------- */
export const MIN_OFFLOAD_PHOTOS = 2;
export const MAX_OFFLOAD_PHOTOS = 20;
export const MAX_FORM_PAGES = 10;

const offloadFields = {
  jobId: z.string().min(1),
  destination: z.enum(
    ["customer", "warehouse", "storage", "carrier", "other"],
    {
      message: "Choose where it was offloaded",
    },
  ),
  storageFacility: z.string().trim().max(120).optional(),
  storageAddress: z.string().trim().max(200).optional(),
  storageUnit: z.string().trim().max(40).optional(),
  carrierId: z.string().optional(),
  note: z.string().trim().max(1000).optional(),
  capturedAtDevice: z.string().min(1),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  accuracy: z.number().int().min(0).max(100000).nullable(),
};

type OffloadWhere = {
  destination: string;
  storageFacility?: string;
  storageAddress?: string;
  storageUnit?: string;
  carrierId?: string;
  note?: string;
};

/** The extra details each "where" option needs */
function checkWhere(d: OffloadWhere, ctx: z.RefinementCtx) {
  const need = (key: keyof OffloadWhere, message: string) => {
    if (!d[key]?.trim()) ctx.addIssue({ code: "custom", path: [key], message });
  };
  if (d.destination === "storage") {
    need("storageFacility", "Facility name is required");
    need("storageAddress", "Facility address is required");
    need("storageUnit", "Unit number is required");
  }
  if (d.destination === "carrier") need("carrierId", "Choose the carrier");
  if (d.destination === "other") need("note", "Say where it was offloaded");
}

const formPagesClient = z.object({
  formId: z.string().min(1),
  name: z.string(),
  required: z.boolean(),
  pages: z
    .array(
      z
        .string()
        .refine(
          (v) =>
            v.startsWith("data:image/") || v.startsWith("data:application/pdf"),
          "Pages must be photos or PDFs",
        ),
    )
    .max(MAX_FORM_PAGES, `Up to ${MAX_FORM_PAGES} pages per form`),
});

export const offloadSchema = z
  .object({
    ...offloadFields,
    photos: z
      .array(z.string().startsWith("data:image/"))
      .min(MIN_OFFLOAD_PHOTOS, `Add at least ${MIN_OFFLOAD_PHOTOS} photos`)
      .max(MAX_OFFLOAD_PHOTOS, `Maximum ${MAX_OFFLOAD_PHOTOS} photos`),
    forms: z.array(formPagesClient).max(30),
  })
  .superRefine((d, ctx) => {
    checkWhere(d, ctx);
    const missing = d.forms.filter((f) => f.required && !f.pages.length);
    if (missing.length)
      ctx.addIssue({
        code: "custom",
        path: ["forms"],
        message: `Required: ${missing.map((f) => f.name).join(", ")}`,
      });
  });

export const offloadServerSchema = z
  .object({
    ...offloadFields,
    photos: z
      .array(storagePath)
      .min(MIN_OFFLOAD_PHOTOS, `Add at least ${MIN_OFFLOAD_PHOTOS} photos`)
      .max(MAX_OFFLOAD_PHOTOS, `Maximum ${MAX_OFFLOAD_PHOTOS} photos`),
    forms: z
      .array(
        z.object({
          formId: z.string().min(1),
          pages: z.array(storagePath).max(MAX_FORM_PAGES),
        }),
      )
      .max(30),
  })
  .superRefine(checkWhere);

/** Admin correction of an offload (evidence can't change) */
export const offloadCorrectionSchema = z
  .object({
    id: z.string().min(1),
    destination: offloadFields.destination,
    storageFacility: offloadFields.storageFacility,
    storageAddress: offloadFields.storageAddress,
    storageUnit: offloadFields.storageUnit,
    carrierId: offloadFields.carrierId,
    note: offloadFields.note,
    reason: z
      .string()
      .trim()
      .min(3, "Give a reason for this correction")
      .max(500),
  })
  .superRefine(checkWhere);
export type OffloadCorrectionInput = z.infer<typeof offloadCorrectionSchema>;

/** Admin adds missing paperwork pages to a submitted offload */
export const offloadPagesSchema = z.object({
  id: z.string().min(1),
  formId: z.string().min(1),
  pages: z
    .array(storagePath)
    .min(1, "Choose at least one page")
    .max(MAX_FORM_PAGES),
  reason: z.string().trim().min(3, "Give a reason").max(500),
});

export const offloadFormsSettingsSchema = z.object({
  forms: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().trim().min(1, "Form name is required").max(80),
        required: z.boolean(),
        active: z.boolean(),
      }),
    )
    .max(30, "Up to 30 forms"),
  alertEmails: z
    .array(z.string().trim().email("Enter a valid email"))
    .max(20, "Up to 20 emails"),
});

/* ---------- Reviews attributed to sales reps (admins) ---------- */
const reviewAttributionFields = {
  repId: z.string().optional(),
  countsForDriver: z.boolean(),
  stars: z.number().int().min(1, "Choose a star rating").max(5),
  platform: z.enum(["google", "bbb", "trustpilot", "facebook", "other"], {
    message: "Choose the platform",
  }),
  reason: z.string().trim().max(300).optional(),
};

const someoneChosen = (d: { repId?: string; countsForDriver: boolean }) =>
  d.countsForDriver || !!d.repId;

export const reviewAttributionSchema = z
  .object({ id: z.string().min(1), ...reviewAttributionFields })
  .refine(someoneChosen, {
    path: ["repId"],
    message: "Choose a sales rep, the driver, or both",
  });
export type ReviewAttributionInput = z.infer<typeof reviewAttributionSchema>;

export const adminReviewServerSchema = z
  .object({
    jobId: z.string().min(1),
    ...reviewAttributionFields,
    reviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Select a date"),
    link: z
      .string()
      .trim()
      .max(2000)
      .refine(
        (v) => !v || /^https?:\/\//i.test(v),
        "Enter a full link (https://...)",
      )
      .optional(),
    screenshot: storagePath.optional(),
  })
  .refine(someoneChosen, {
    path: ["repId"],
    message: "Choose a sales rep, the driver, or both",
  });

export const adminReviewSchema = z
  .object({
    jobId: z.string().min(1),
    ...reviewAttributionFields,
    reviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Select a date"),
    link: z
      .string()
      .trim()
      .max(2000)
      .refine(
        (v) => !v || /^https?:\/\//i.test(v),
        "Enter a full link (https://...)",
      )
      .optional(),
    screenshot: z.string().startsWith("data:image/").optional(),
  })
  .refine(someoneChosen, {
    path: ["repId"],
    message: "Choose a sales rep, the driver, or both",
  });
