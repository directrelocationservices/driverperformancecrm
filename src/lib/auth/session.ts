// File: src/lib/auth/session.ts
// (REPLACE the whole file)

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role, User } from "@/types";
import { homeFor } from "./roles";

/** Logged-in user with their profile. Cached for the length of one request. */
export const getSession = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, name, email, phone, role, active, avatar_url, must_change_password",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.active) return null;

  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    phone: profile.phone ?? undefined,
    role: profile.role,
    active: profile.active,
    avatarUrl: profile.avatar_url ?? undefined,
    mustChangePassword: profile.must_change_password,
  };
});

export async function requireRole(role: Role) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  // Send them to their own portal (never to "/", which could loop)
  if (user.role !== role) redirect(homeFor(user.role));
  return user;
}

/** Any logged-in, active user (any role) */
export async function requireUser() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  return user;
}
