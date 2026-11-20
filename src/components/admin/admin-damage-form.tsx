// File: src/components/admin/admin-damage-form.tsx
// (NEW file)

"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Field,
  FormError,
  FormSection,
  MoneyInput,
  NativeSelect,
  Segmented,
  TEXTAREA_CLASS,
} from "@/components/driver/form-bits";
import { PhotoPicker } from "@/components/driver/photo-picker";
import { FormActions } from "@/components/driver/form-actions";
import { adminCreateDamageAction } from "@/app/(admin)/admin/actions";
import {
  adminDamageSchema,
  DAMAGE_SOURCES,
  toFieldErrors,
} from "@/lib/validation/driver";
import { OfflineUploadError, prepareEvidence } from "@/lib/evidence/upload";
import { DAMAGE_SOURCE_LABELS } from "@/types";

type YesNo = "yes" | "no" | "";
export type DamageJobOption = {
  id: string;
  jobNumber: string;
  date: string;
  partner: boolean;
};

const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Damage added by an admin, from the driver profile or from a job */
export function AdminDamageForm({
  jobs,
  fixedJobId,
  cancelHref,
}: {
  jobs: DamageJobOption[];
  fixedJobId?: string;
  cancelHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  // Same key on a retry, so photos already uploaded are reused
  const key = useRef(`admin-${crypto.randomUUID()}`);

  const fixed = jobs.find((j) => j.id === fixedJobId);
  const [jobNumber, setJobNumber] = useState(fixed?.jobNumber ?? "");
  const [damageDate, setDamageDate] = useState(today());
  const [source, setSource] = useState<string>("");
  const [item, setItem] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [claim, setClaim] = useState<YesNo>("");
  const [cost, setCost] = useState("");

  const byNumber = useMemo(
    () => new Map(jobs.map((j) => [j.jobNumber.trim().toLowerCase(), j])),
    [jobs],
  );
  const job = fixed ?? byNumber.get(jobNumber.trim().toLowerCase());

  const clear = (k: string) =>
    errors[k] && setErrors((e) => ({ ...e, [k]: "" }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(undefined);
    const payload = {
      jobId: job?.id ?? "",
      damageDate,
      source,
      item,
      description,
      photos,
      claimFiled: claim === "" ? undefined : claim === "yes",
      estimatedCost: cost === "" ? undefined : Number(cost),
    };

    const check = adminDamageSchema.safeParse(payload);
    if (!check.success) {
      const fe = toFieldErrors(check.error);
      if (fe.jobId)
        fe.jobNumber = jobNumber.trim()
          ? "This job number isn't in this driver's jobs"
          : "Enter the job number";
      setErrors(fe);
      setFormError("Please fix the highlighted fields.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    startTransition(async () => {
      try {
        const ready = await prepareEvidence("damage", payload, key.current);
        const res = await adminCreateDamageAction(ready);
        if (res.fieldErrors) {
          setErrors(res.fieldErrors);
          setFormError("Please fix the highlighted fields.");
          return;
        }
        if (res.error) {
          setFormError(res.error);
          return;
        }
        toast.success("Damage added. It now counts in the driver's stats.");
        router.push(`/admin/jobs/${res.jobId}`);
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
      {job?.partner && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This job was delivered by a partner. The damage is recorded but
            won&apos;t count against the driver&apos;s damage rate.
          </p>
        </div>
      )}

      <FormError message={formError} />

      <FormSection title="Job & source">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Job number"
            htmlFor="jobNumber"
            error={errors.jobNumber}
            hint={
              fixed
                ? undefined
                : job
                  ? `Job date ${job.date}`
                  : "Type or pick one of this driver's jobs"
            }
          >
            <Input
              id="jobNumber"
              list="damage-job-numbers"
              value={jobNumber}
              disabled={!!fixed}
              onChange={(e) => {
                setJobNumber(e.target.value);
                clear("jobNumber");
              }}
              placeholder="e.g. 5444198"
              aria-invalid={!!errors.jobNumber}
              className="h-12 bg-white text-base"
            />
            {!fixed && (
              <datalist id="damage-job-numbers">
                {jobs.map((j) => (
                  <option key={j.id} value={j.jobNumber}>
                    {j.date}
                  </option>
                ))}
              </datalist>
            )}
          </Field>
          <Field
            label="Date of damage"
            htmlFor="damageDate"
            error={errors.damageDate}
          >
            <Input
              id="damageDate"
              type="date"
              value={damageDate}
              onChange={(e) => {
                setDamageDate(e.target.value);
                clear("damageDate");
              }}
              aria-invalid={!!errors.damageDate}
              className="h-12 bg-white text-base"
            />
          </Field>
        </div>
        <Field label="Source" htmlFor="source" error={errors.source}>
          <NativeSelect
            id="source"
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              clear("source");
            }}
            aria-invalid={!!errors.source}
          >
            <option value="">Select where this came from</option>
            {DAMAGE_SOURCES.map((s) => (
              <option key={s} value={s}>
                {DAMAGE_SOURCE_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </FormSection>

      <FormSection title="What was damaged">
        <Field label="Item" htmlFor="item" error={errors.item}>
          <Input
            id="item"
            value={item}
            onChange={(e) => {
              setItem(e.target.value);
              clear("item");
            }}
            placeholder="e.g. Dining table"
            aria-invalid={!!errors.item}
            className="h-12 bg-white text-base"
          />
        </Field>
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
            placeholder="e.g. Customer called: scratch on the table top after delivery"
            aria-invalid={!!errors.description}
            className={TEXTAREA_CLASS}
          />
        </Field>
      </FormSection>

      <FormSection title="Photos" description="Optional, up to 5.">
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

      <FormSection title="Claim & cost">
        <Field label="Customer claim filed?" error={errors.claimFiled}>
          <Segmented
            ariaLabel="Customer claim filed"
            value={claim}
            onChange={(v) => {
              setClaim(v);
              clear("claimFiled");
            }}
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
          />
        </Field>
        <Field
          label="Estimated cost"
          htmlFor="cost"
          error={errors.estimatedCost}
        >
          <MoneyInput
            id="cost"
            value={cost}
            onChange={(v) => {
              setCost(v);
              clear("estimatedCost");
            }}
            invalid={!!errors.estimatedCost}
          />
        </Field>
      </FormSection>

      <FormActions cancelHref={cancelHref} pending={pending}>
        Add damage
      </FormActions>
    </form>
  );
}
