// File: src/components/admin/admin-pre-damage-form.tsx
// (NEW file)

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Field,
  FormError,
  FormSection,
  TEXTAREA_CLASS,
} from "@/components/driver/form-bits";
import { PhotoPicker } from "@/components/driver/photo-picker";
import { FormActions } from "@/components/driver/form-actions";
import { adminAddPreDamageAction } from "@/app/(admin)/admin/job-actions";
import { officePreDamageSchema, toFieldErrors } from "@/lib/validation/driver";
import { OfflineUploadError, prepareEvidence } from "@/lib/evidence/upload";
import { cn } from "@/lib/utils";

/** Pre-existing damage photos the driver sent later, uploaded by the office */
export function AdminPreDamageForm({
  jobId,
  defaultCustomer,
  cancelHref,
}: {
  jobId: string;
  defaultCustomer?: string | null;
  cancelHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const key = useRef(`office-${crypto.randomUUID()}`);

  const [item, setItem] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState(defaultCustomer ?? "");
  const [customerShown, setCustomerShown] = useState(false);

  const clear = (k: string) =>
    errors[k] && setErrors((e) => ({ ...e, [k]: "" }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(undefined);
    const payload = {
      jobId,
      item,
      location,
      description,
      notes: notes || undefined,
      photos,
      customerName,
      customerShown,
    };
    const check = officePreDamageSchema.safeParse(payload);
    if (!check.success) {
      setErrors(toFieldErrors(check.error));
      setFormError("Please fix the highlighted fields.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    startTransition(async () => {
      try {
        const ready = await prepareEvidence("pre_damage", payload, key.current);
        const res = await adminAddPreDamageAction(ready);
        if (res.fieldErrors) {
          setErrors(res.fieldErrors);
          setFormError("Please fix the highlighted fields.");
          return;
        }
        if (res.error) {
          setFormError(res.error);
          return;
        }
        toast.success(
          "Pre-existing damage added (marked as entered by office).",
        );
        router.push(`/admin/jobs/${jobId}`);
      } catch (err) {
        setFormError(
          err instanceof OfflineUploadError
            ? "No connection. Please try again when you're online."
            : "Photos couldn't be uploaded. Please try again.",
        );
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          This record will be labeled <b>Entered by office</b> with your name
          and the time. It has no on-site device time, GPS or customer
          signature, and the claims PDF says so. Upload the signed paperwork
          under <b>Documents</b> on the job page.
        </p>
      </div>

      <FormError message={formError} />

      <FormSection title="What was damaged">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Item" htmlFor="item" error={errors.item}>
            <Input
              id="item"
              value={item}
              onChange={(e) => {
                setItem(e.target.value);
                clear("item");
              }}
              placeholder="e.g. Oak dresser"
              aria-invalid={!!errors.item}
              className="h-12 bg-white text-base"
            />
          </Field>
          <Field
            label="Location on item"
            htmlFor="location"
            error={errors.location}
          >
            <Input
              id="location"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                clear("location");
              }}
              placeholder="e.g. Top, front-left corner"
              aria-invalid={!!errors.location}
              className="h-12 bg-white text-base"
            />
          </Field>
        </div>
        <Field
          label="Description"
          htmlFor="description"
          error={errors.description}
        >
          <textarea
            id="description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              clear("description");
            }}
            placeholder="e.g. Deep scratch across the top surface"
            aria-invalid={!!errors.description}
            className={TEXTAREA_CLASS}
          />
        </Field>
        <Field label="Notes" htmlFor="notes" optional>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Driver sent these photos by text on Nov 3"
            className={TEXTAREA_CLASS}
          />
        </Field>
      </FormSection>

      <FormSection title="Photos" description="At least 1, up to 5.">
        <Field label="Damage photos" error={errors.photos}>
          <PhotoPicker
            value={photos}
            onChange={(p) => {
              setPhotos(p);
              clear("photos");
            }}
            invalid={!!errors.photos}
          />
        </Field>
      </FormSection>

      <FormSection title="Customer">
        <Field
          label="Customer name"
          htmlFor="customerName"
          error={errors.customerName}
        >
          <Input
            id="customerName"
            value={customerName}
            onChange={(e) => {
              setCustomerName(e.target.value);
              clear("customerName");
            }}
            aria-invalid={!!errors.customerName}
            className="h-12 bg-white text-base"
          />
        </Field>
        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition",
            customerShown ? "border-primary bg-primary/5" : "bg-white",
          )}
        >
          <input
            type="checkbox"
            checked={customerShown}
            onChange={(e) => setCustomerShown(e.target.checked)}
            className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--primary)]"
          />
          <span className="text-[15px] font-semibold leading-snug">
            The driver says the customer was shown this damage before loading
          </span>
        </label>
      </FormSection>

      <FormActions cancelHref={cancelHref} pending={pending}>
        Add pre-existing damage
      </FormActions>
    </form>
  );
}
