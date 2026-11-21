// File: src/app/(admin)/admin/granot-actions.ts
// (REPLACE the whole file)

"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Saves a rep's Granot username, then links their existing unassigned
 * Granot leads to them. Returns how many leads were linked.
 */
export async function saveGranotNameAction(
  userId: string,
  granotName: string,
): Promise<{ error?: string; linked?: number }> {
  await requireRole("admin");
  const name = granotName.trim();
  if (name.length > 80) return { error: "Username is too long." };

  const sb = createAdminClient();
  const { data: rep } = await sb
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();
  // Admins can have a Granot name too (their leads stay out of the rep comparison)
  if (!rep || (rep.role !== "sales_rep" && rep.role !== "admin"))
    return { error: "Choose a sales rep or an admin." };

  if (name) {
    const { data: taken } = await sb
      .from("profiles")
      .select("id, name")
      .ilike(
        "granot_name",
        name.replace(/[\\%_]/g, (m) => `\\${m}`),
      )
      .neq("id", userId)
      .limit(1);
    if (taken?.length)
      return { error: `"${name}" is already used by ${taken[0].name}.` };
  }

  const { error } = await sb
    .from("profiles")
    .update({ granot_name: name || null })
    .eq("id", userId);
  if (error) return { error: "Couldn't save. Please try again." };

  let linked = 0;
  if (name) {
    const { data } = await sb
      .from("leads")
      .update({ rep_id: userId })
      .is("rep_id", null)
      .ilike(
        "granot_rep",
        name.replace(/[\\%_]/g, (m) => `\\${m}`),
      )
      .select("id");
    linked = data?.length ?? 0;
  }
  revalidatePath("/admin", "layout");
  revalidatePath("/sales", "layout");
  return { linked };
}
