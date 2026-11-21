// File: src/app/(admin)/admin/cost-range-actions.ts
// (NEW file)

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { deleteCostRange, saveCostRange } from "@/lib/data";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Select a date");

const rangeSchema = z
  .object({
    id: z.string().uuid().optional(),
    sourceId: z.string().uuid({ message: "Select a source" }),
    startDate: day,
    endDate: day,
    mode: z.enum(["per_lead", "total"], { message: "Choose a cost type" }),
    amount: z
      .number({ message: "Enter an amount" })
      .min(0, "Can't be negative")
      .max(10_000_000),
    note: z.string().trim().max(300).optional(),
  })
  .refine((d) => d.endDate >= d.startDate, {
    path: ["endDate"],
    message: "End date must be on or after the start date",
  });
export type CostRangeInput = z.infer<typeof rangeSchema>;

export type CostRangeResult = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/sales", "layout");
}

export async function saveCostRangeAction(
  input: CostRangeInput,
): Promise<CostRangeResult> {
  await requireRole("admin");
  const parsed = rangeSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0] ?? "form");
      if (!fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { fieldErrors };
  }
  try {
    await saveCostRange(parsed.data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/already has a date-range cost/i.test(msg))
      return {
        fieldErrors: {
          startDate:
            "This source already has a date-range cost in these dates. Edit that one instead.",
        },
      };
    console.error(err);
    return { error: "Couldn't save. Please try again." };
  }
  refresh();
  return {};
}

export async function deleteCostRangeAction(
  id: string,
): Promise<CostRangeResult> {
  await requireRole("admin");
  if (!z.string().uuid().safeParse(id).success)
    return { error: "Cost range not found." };
  try {
    await deleteCostRange(id);
  } catch (err) {
    console.error(err);
    return { error: "Couldn't delete. Please try again." };
  }
  refresh();
  return {};
}
