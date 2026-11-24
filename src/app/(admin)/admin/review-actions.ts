// File: src/app/(admin)/admin/review-actions.ts
// (NEW file)

"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { attributeReview, createReview, getJob, getUserById } from "@/lib/data";
import {
  adminReviewServerSchema,
  reviewAttributionSchema,
  toFieldErrors,
  type ReviewAttributionInput,
} from "@/lib/validation/driver";
import { isEvidencePathFor } from "@/lib/evidence/paths";
import type { ReviewPlatform } from "@/types";

type Result = {
  error?: string;
  fieldErrors?: Record<string, string>;
  jobId?: string;
};

const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

async function repOk(repId?: string) {
  if (!repId) return true;
  const rep = isUuid(repId) ? await getUserById(repId) : null;
  return rep?.role === "sales_rep";
}

function refresh(jobId: string, repId?: string | null) {
  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/sales", "layout");
  revalidatePath("/admin/drivers", "layout");
  if (repId) revalidatePath(`/admin/sales/reps/${repId}`);
}

/** Admin attributes a review to a sales rep and / or the driver */
export async function attributeReviewAction(
  input: ReviewAttributionInput,
): Promise<Result> {
  await requireRole("admin");
  const parsed = reviewAttributionSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };
  const d = parsed.data;
  if (!isUuid(d.id)) return { error: "Review not found." };
  if (!(await repOk(d.repId)))
    return { fieldErrors: { repId: "Choose a sales rep" } };

  try {
    const rec = await attributeReview(
      d.id,
      {
        repId: d.repId || null,
        countsForDriver: d.countsForDriver,
        stars: d.stars,
        platform: d.platform as ReviewPlatform,
        reason: d.reason,
      },
      "Review attribution updated",
    );
    if (!rec) return { error: "Review not found." };
    refresh(rec.jobId, d.repId);
    return { jobId: rec.jobId };
  } catch (err) {
    console.error(err);
    return { error: "Couldn't save. Please try again." };
  }
}

/** Admin adds a review (e.g. found online or read out on a call) */
export async function adminAddReviewAction(input: unknown): Promise<Result> {
  await requireRole("admin");
  const parsed = adminReviewServerSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };
  const d = parsed.data;

  const job = isUuid(d.jobId) ? await getJob(d.jobId) : null;
  if (!job) return { error: "Job not found." };
  if (!(await repOk(d.repId)))
    return { fieldErrors: { repId: "Choose a sales rep" } };
  if (d.screenshot && !isEvidencePathFor(d.screenshot, job.id, "review"))
    return {
      error: "The screenshot didn't upload correctly. Please try again.",
    };

  try {
    await createReview({
      jobId: job.id,
      platform: d.platform as ReviewPlatform,
      stars: d.stars,
      driverMentioned: d.countsForDriver,
      link: d.link || undefined,
      screenshotPath: d.screenshot || undefined,
      repId: d.repId || null,
      countsForDriver: d.countsForDriver,
      reason: d.reason,
      reviewDate: d.reviewDate,
      addedByAdmin: true,
    });
    refresh(job.id, d.repId);
    return { jobId: job.id };
  } catch (err) {
    console.error(err);
    return { error: "Couldn't save. Please try again." };
  }
}
