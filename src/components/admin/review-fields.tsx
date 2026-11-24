// File: src/components/admin/review-fields.tsx
// (NEW file)

"use client";

import { Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/driver/form-bits";
import { cn } from "@/lib/utils";
import { REVIEW_PLATFORM_LABELS, type ReviewPlatform } from "@/types";

export type ReviewFieldValues = {
  stars: number;
  platform: ReviewPlatform | "";
  repId: string;
  countsForDriver: boolean;
  reason: string;
};

/** Quick picks for the reason field */
export const REVIEW_REASONS = [
  "Explained process well",
  "Great communication",
  "Delivery window not explained",
  "Price change",
  "No callback",
  "Crew did a great job",
  "Damage",
  "Late pickup or delivery",
];

/** Stars, platform, who it's about (rep and / or driver) and a short reason */
export function ReviewFields({
  v,
  set,
  errors,
  reps,
  driverName,
}: {
  v: ReviewFieldValues;
  set: (patch: Partial<ReviewFieldValues>) => void;
  errors: Record<string, string>;
  reps: { id: string; name: string }[];
  driverName: string;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Star rating" error={errors.stars}>
          <div
            className="flex gap-1"
            role="radiogroup"
            aria-label="Star rating"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={v.stars === n}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                onClick={() => set({ stars: n })}
                className="flex h-11 w-11 items-center justify-center rounded-lg border bg-white transition hover:border-foreground/30"
              >
                <Star
                  className={cn(
                    "h-5 w-5",
                    n <= v.stars
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/40",
                  )}
                />
              </button>
            ))}
          </div>
        </Field>
        <Field label="Platform" error={errors.platform}>
          <NativeSelect
            value={v.platform}
            onChange={(e) =>
              set({ platform: e.target.value as ReviewPlatform })
            }
            aria-invalid={!!errors.platform}
          >
            <option value="">Choose the platform</option>
            {(Object.keys(REVIEW_PLATFORM_LABELS) as ReviewPlatform[]).map(
              (p) => (
                <option key={p} value={p}>
                  {REVIEW_PLATFORM_LABELS[p]}
                </option>
              ),
            )}
          </NativeSelect>
        </Field>
      </div>

      <Field
        label="Sales rep"
        error={errors.repId}
        hint="The rep this review is about, if it's about the sale."
      >
        <NativeSelect
          value={v.repId}
          onChange={(e) => set({ repId: e.target.value })}
          aria-invalid={!!errors.repId}
        >
          <option value="">No sales rep</option>
          {reps.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition",
          v.countsForDriver ? "border-primary bg-primary/5" : "bg-white",
        )}
      >
        <input
          type="checkbox"
          checked={v.countsForDriver}
          onChange={(e) => set({ countsForDriver: e.target.checked })}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]"
        />
        <span className="text-sm">
          <b>Counts for the driver ({driverName})</b>
          <span className="block text-muted-foreground">
            Untick if the review is only about the sale.
          </span>
        </span>
      </label>

      <Field label="Reason" optional error={errors.reason}>
        <Input
          value={v.reason}
          onChange={(e) => set({ reason: e.target.value })}
          placeholder="e.g. Delivery window not explained"
          maxLength={300}
          className="h-11 bg-white"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {REVIEW_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => set({ reason: r })}
              className="rounded-full border bg-white px-2.5 py-1 text-xs font-medium text-foreground/80 hover:border-foreground/30"
            >
              {r}
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}
