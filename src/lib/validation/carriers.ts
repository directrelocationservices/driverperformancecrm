// File: src/lib/validation/carriers.ts
// (NEW file)

import { z } from "zod";
import { isClaimPathFor } from "@/lib/carriers";

const noteSchema = z.object({
  claimId: z.string().uuid(),
  note: z.string().trim().min(1, "Write a note").max(4000),
  files: z
    .array(z.object({ path: z.string(), name: z.string().max(200) }))
    .max(5, "Maximum 5 files"),
  internal: z.boolean(),
});
export type ClaimNoteInput = z.infer<typeof noteSchema>;

/** Checks a claim note (admin or carrier); files must be in the claim's folder */
export function parseClaimNote(
  input: unknown,
):
  | { data: ClaimNoteInput; error?: undefined }
  | { data?: undefined; error: string } {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid note" };
  const d = parsed.data;
  if (!d.files.every((f) => isClaimPathFor(f.path, d.claimId)))
    return { error: "A file didn't upload correctly. Please try again." };
  return { data: d };
}
