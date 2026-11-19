// File: src/app/(auth)/change-password/page.tsx
// (NEW file)

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/roles";
import { Brand } from "@/components/shared/brand";
import { LogoutButton } from "@/components/shared/logout-button";
import { PasswordForm } from "@/components/account/password-form";

export const metadata = { title: "Set your password" };
export const dynamic = "force-dynamic";

/** First login: the user must replace their temporary password before using the portal */
export default async function ChangePasswordPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!user.mustChangePassword) redirect(homeFor(user.role));

  return (
    <main className="min-h-dvh bg-muted/40 px-5 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Brand compact />
          <LogoutButton />
        </div>
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">
            Welcome, {user.name}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Before you start, please set your own password.
          </p>
        </div>
        <PasswordForm firstLogin redirectTo={homeFor(user.role)} />
      </div>
    </main>
  );
}
