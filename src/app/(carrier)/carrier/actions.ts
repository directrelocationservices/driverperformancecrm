// File: src/app/(carrier)/carrier/actions.ts
// (NEW file)

"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { addCarrierClaimNote, claimVisible } from "@/lib/data";
import { parseClaimNote } from "@/lib/validation/carriers";

/** A carrier comments on its own claim (and can attach documents) */
export async function addCarrierNoteAction(
  input: unknown,
): Promise<{ error?: string }> {
  await requireRole("carrier");
  const p = parseClaimNote(input);
  if (!p.data) return { error: p.error };
  if (!(await claimVisible(p.data.claimId)))
    return { error: "Claim not found." };
  try {
    await addCarrierClaimNote({
      claimId: p.data.claimId,
      note: p.data.note,
      filePaths: p.data.files.map((f) => f.path),
      fileNames: p.data.files.map((f) => f.name),
      internal: false,
    });
  } catch (err) {
    console.error(err);
    return { error: "Couldn't save. Please try again." };
  }
  revalidatePath(`/carrier/claims/${p.data.claimId}`);
  revalidatePath(`/admin/carriers/claims/${p.data.claimId}`);
  return {};
}
