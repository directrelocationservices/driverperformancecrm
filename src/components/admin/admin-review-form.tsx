// File: src/components/admin/admin-review-form.tsx
// (NEW file)

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Field, FormError, FormSection } from "@/components/driver/form-bits";
import { FormActions } from "@/components/driver/form-actions";
import { PhotoPicker } from "@/components/driver/photo-picker";
import { adminAddReviewAction } from "@/app/(admin)/admin/review-actions";
import { adminReviewSchema, toFieldErrors } from "@/lib/validation/driver";
import { OfflineUploadError, prepareEvidence } from "@/lib/evidence/upload";
import { ReviewFields, type ReviewFieldValues } from "./review-fields";

const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Admin adds a review to a job and says who it's about */
export function AdminReviewForm({
  jobId,
  reps,
  driverName,
  suggestedRepId,
  cancelHref,
}: {
  jobId: string;
  reps: { id: string; name: string }[];
  driverName: string;
  suggestedRepId?: string | null;
  cancelHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const key = useRef(`admin-${crypto.randomUUID()}`);

  const [v, setV] = useState<ReviewFieldValues>({
    stars: 0,
    platform: "",
    repId: suggestedRepId ?? "",
    countsForDriver: true,
    reason: "",
  });
  const [reviewDate, setReviewDate] = useState(today());
  const [link, setLink] = useState("");
  const [shot, setShot] = useState<string[]>([]);

  const set = (patch: Partial<ReviewFieldValues>) => {
    setV((s) => ({ ...s, ...patch }));
    setErrors({});
  };

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(undefined);
    const payload = {
      jobId,
      stars: v.stars,
      platform: v.platform,
      repId: v.repId || undefined,
      countsForDriver: v.countsForDriver,
      reason: v.reason || undefined,
      reviewDate,
      link: link.trim() || undefined,
      screenshot: shot[0],
    };
    const check = adminReviewSchema.safeParse(payload);
    if (!check.success) {
      setErrors(toFieldErrors(check.error));
      setFormError("Please fix the highlighted fields.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    startTransition(async () => {
      try {
        const ready = await prepareEvidence("review", payload, key.current);
        const res = await adminAddReviewAction(ready);
        if (res.fieldErrors) {
          setErrors(res.fieldErrors);
          setFormError("Please fix the highlighted fields.");
          return;
        }
        if (res.error) {
          setFormError(res.error);
          return;
        }
        toast.success("Review added.");
        router.push(`/admin/jobs/${jobId}`);
      } catch (err) {
        setFormError(
          err instanceof OfflineUploadError
            ? "No connection. Please try again when you're online."
            : "The screenshot couldn't be uploaded. Please try again.",
        );
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError message={formError} />
      <FormSection title="Review">
        <ReviewFields
          v={v}
          set={set}
          errors={errors}
          reps={reps}
          driverName={driverName}
        />
        <Field
          label="Review date"
          htmlFor="reviewDate"
          error={errors.reviewDate}
        >
          <Input
            id="reviewDate"
            type="date"
            value={reviewDate}
            onChange={(e) => setReviewDate(e.target.value)}
            className="h-12 bg-white text-base"
          />
        </Field>
      </FormSection>
      <FormSection
        title="Proof"
        description="Optional: a link to the review or a screenshot."
      >
        <Field label="Link" htmlFor="link" optional error={errors.link}>
          <Input
            id="link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://..."
            className="h-12 bg-white text-base"
          />
        </Field>
        <Field label="Screenshot" optional>
          <PhotoPicker value={shot} onChange={setShot} max={1} />
        </Field>
      </FormSection>
      <FormActions cancelHref={cancelHref} pending={pending}>
        Add review
      </FormActions>
    </form>
  );
}
