// File: src/app/(admin)/admin/readiness-actions.ts
// (NEW file)

"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { clearHold, deleteDocument, saveChecklist } from "@/lib/data";
import { createDocumentFor } from "@/lib/services/fleet";
import { checklistSchema } from "@/lib/validation/fleet";

type Result = { error?: string; fieldErrors?: Record<string, string> };

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/driver", "layout");
}

/** Upload a truck document, or a driver's medical card / license */
export async function uploadDocumentAction(input: unknown): Promise<Result> {
  const admin = await requireRole("admin");
  const res = await createDocumentFor(admin, input);
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  return {};
}

export async function deleteDocumentAction(id: string): Promise<Result> {
  await requireRole("admin");
  try {
    const row = await deleteDocument(id);
    if (!row) return { error: "Document not found." };
  } catch (err) {
    console.error(err);
    return { error: "Couldn't delete it. Please try again." };
  }
  refresh();
  return {};
}

/** The driver fixed what held the trip (e.g. got the log sheets) */
export async function clearHoldAction(
  preTripId: string,
  note: string,
): Promise<Result> {
  await requireRole("admin");
  if ((note ?? "").trim().length < 3)
    return { fieldErrors: { note: "Add a short note" } };
  try {
    const id = await clearHold(preTripId, note.trim());
    if (!id) return { error: "This hold was already cleared." };
  } catch (err) {
    console.error(err);
    return { error: "Couldn't clear the hold. Please try again." };
  }
  refresh();
  return {};
}

/** Admin → Settings: the daily pre-trip checklist */
export async function saveChecklistAction(input: unknown): Promise<Result> {
  await requireRole("admin");
  const parsed = checklistSchema.safeParse(input);
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Please check the items.",
    };
  const keys = parsed.data.map((i) => i.key);
  if (new Set(keys).size !== keys.length)
    return { error: "Two items have the same key." };
  const labels = parsed.data.map((i) => i.label.toLowerCase());
  if (new Set(labels).size !== labels.length)
    return { error: "Two items have the same name." };
  try {
    await saveChecklist(
      parsed.data.map((i) => ({ ...i, hint: i.hint || undefined })),
    );
  } catch (err) {
    console.error(err);
    return { error: "Couldn't save the checklist. Please try again." };
  }
  refresh();
  return {};
}
