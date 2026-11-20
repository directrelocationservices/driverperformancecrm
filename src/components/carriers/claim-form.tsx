// File: src/components/carriers/claim-form.tsx
// (NEW file)

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Field,
  FormError,
  FormSection,
  MoneyInput,
  NativeSelect,
  TEXTAREA_CLASS,
} from "@/components/driver/form-bits";
import { PhotoPicker } from "@/components/driver/photo-picker";
import { FormActions } from "@/components/driver/form-actions";
import { createClaimAction } from "@/app/(admin)/admin/carrier-actions";
import { uploadClaimPhoto } from "@/lib/carriers-upload";

export type ClaimJobOption = { id: string; label: string };

/** Admin: new damage claim against a carrier, on one of its partner jobs */
export function ClaimForm({
  carrierId,
  jobs,
  defaultJobId,
}: {
  carrierId: string;
  jobs: ClaimJobOption[];
  defaultJobId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  // The claim id is made here so its photos go straight into its own folder
  const claimId = useRef(crypto.randomUUID());

  const [jobId, setJobId] = useState(defaultJobId ?? "");
  const [item, setItem] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [amount, setAmount] = useState("");

  const clear = (k: string) =>
    errors[k] && setErrors((e) => ({ ...e, [k]: "" }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(undefined);
    const local: Record<string, string> = {};
    if (!jobId) local.jobId = "Select the job";
    if (!item.trim()) local.item = "Item is required";
    if (!description.trim()) local.description = "Describe the damage";
    if (amount === "") local.claimAmount = "Enter the claim amount";
    if (Object.keys(local).length) {
      setErrors(local);
      setFormError("Please fix the highlighted fields.");
      return;
    }

    startTransition(async () => {
      try {
        const paths: string[] = [];
        for (const p of photos)
          paths.push(await uploadClaimPhoto(claimId.current, p));
        const res = await createClaimAction({
          id: claimId.current,
          carrierId,
          jobId,
          item,
          description,
          photos: paths,
          claimAmount: Number(amount),
        });
        if (res.fieldErrors) {
          setErrors(res.fieldErrors);
          setFormError("Please fix the highlighted fields.");
        } else if (res.error) setFormError(res.error);
        else {
          toast.success("Claim added.");
          router.push(`/admin/carriers/claims/${res.id}`);
        }
      } catch (err) {
        setFormError(
          err instanceof Error
            ? err.message
            : "Couldn't save. Please try again.",
        );
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError message={formError} />

      <FormSection
        title="Job"
        description="Partner-delivered jobs of this carrier, and partner jobs with no carrier yet."
      >
        <Field label="Job" htmlFor="jobId" error={errors.jobId}>
          <NativeSelect
            id="jobId"
            value={jobId}
            onChange={(e) => {
              setJobId(e.target.value);
              clear("jobId");
            }}
            aria-invalid={!!errors.jobId}
          >
            <option value="">Select a job</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </FormSection>

      <FormSection title="Delivery damage">
        <Field label="Item" htmlFor="item" error={errors.item}>
          <Input
            id="item"
            value={item}
            onChange={(e) => {
              setItem(e.target.value);
              clear("item");
            }}
            placeholder="e.g. Leather sofa"
            aria-invalid={!!errors.item}
            className="h-12 bg-white text-base"
          />
        </Field>
        <Field
          label="What happened"
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
            placeholder="e.g. Tear on the left arm, found by the customer at delivery"
            aria-invalid={!!errors.description}
            className={TEXTAREA_CLASS}
          />
        </Field>
        <Field label="Delivery damage photos" optional error={errors.photos}>
          <PhotoPicker value={photos} onChange={setPhotos} max={10} />
        </Field>
      </FormSection>

      <FormSection title="Claim">
        <Field
          label="Claim amount"
          htmlFor="claimAmount"
          error={errors.claimAmount}
          hint="What the customer is claiming. Paid and charged-back amounts are added later."
        >
          <MoneyInput
            id="claimAmount"
            value={amount}
            onChange={(v) => {
              setAmount(v);
              clear("claimAmount");
            }}
            invalid={!!errors.claimAmount}
          />
        </Field>
      </FormSection>

      <FormActions
        cancelHref={`/admin/carriers/${carrierId}`}
        pending={pending}
      >
        Add claim
      </FormActions>
    </form>
  );
}
