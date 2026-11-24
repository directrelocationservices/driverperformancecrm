// File: src/components/admin/review-attribution.tsx
// (NEW file)

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/driver/form-bits";
import { attributeReviewAction } from "@/app/(admin)/admin/review-actions";
import { ReviewFields, type ReviewFieldValues } from "./review-fields";
import type { Review } from "@/types";

/** Admin: attribute a review to a sales rep and / or the driver */
export function ReviewAttribution({
  review,
  reps,
  driverName,
  suggestedRepId,
}: {
  review: Review;
  reps: { id: string; name: string }[];
  driverName: string;
  /** The rep on the matching Granot lead, if any */
  suggestedRepId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();

  const initial: ReviewFieldValues = {
    stars: review.stars,
    platform: review.platform,
    repId: review.repId ?? suggestedRepId ?? "",
    countsForDriver: review.countsForDriver ?? true,
    reason: review.reason ?? "",
  };
  const [v, setV] = useState(initial);
  const set = (patch: Partial<ReviewFieldValues>) => {
    setV((s) => ({ ...s, ...patch }));
    setErrors({});
  };

  const save = () =>
    startTransition(async () => {
      setFormError(undefined);
      const res = await attributeReviewAction({
        id: review.id,
        repId: v.repId || undefined,
        countsForDriver: v.countsForDriver,
        stars: v.stars,
        platform: (v.platform || "other") as Review["platform"],
        reason: v.reason || undefined,
      });
      if (res.fieldErrors) setErrors(res.fieldErrors);
      else if (res.error) setFormError(res.error);
      else {
        toast.success("Review saved. The change is kept in the history.");
        setOpen(false);
        router.refresh();
      }
    });

  if (!open)
    return (
      <button
        type="button"
        onClick={() => {
          setV(initial);
          setOpen(true);
        }}
        className="flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 text-sm font-semibold transition hover:border-foreground/30"
      >
        <UserCheck className="h-4 w-4" /> Attribute
      </button>
    );

  return (
    <div className="w-full space-y-4 rounded-xl border-2 border-primary/30 bg-primary/[0.03] p-4">
      <p className="font-semibold">Who is this review about?</p>
      <FormError message={formError} />
      <ReviewFields
        v={v}
        set={set}
        errors={errors}
        reps={reps}
        driverName={driverName}
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-11 rounded-lg px-5 text-sm font-semibold text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
        <Button
          type="button"
          disabled={pending}
          onClick={save}
          className="h-11 px-6 font-semibold"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </div>
    </div>
  );
}
