// File: src/components/carriers/carrier-logins.tsx
// (NEW file)

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, LogIn, Plus, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/shared/modal";
import { Pill } from "@/components/shared/pill";
import { Field, FormError } from "@/components/driver/form-bits";
import { PasswordField } from "@/components/admin/password-field";
import { PasswordReveal } from "@/components/admin/password-reveal";
import { SetPasswordDialog } from "@/components/admin/user-row-actions";
import { setUserActiveAction } from "@/app/(admin)/admin/actions";
import { createCarrierLoginAction } from "@/app/(admin)/admin/carrier-actions";
import type { User } from "@/types";

const btn =
  "flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 text-sm font-semibold transition disabled:opacity-50";

function LoginRow({ user }: { user: User }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pwOpen, setPwOpen] = useState(false);

  const toggle = () =>
    startTransition(async () => {
      const res = await setUserActiveAction(user.id, !user.active);
      if (res?.error) toast.error(res.error);
      else {
        toast.success(
          user.active
            ? `Login turned off for ${user.name}`
            : `Login turned on for ${user.name}`,
        );
        router.refresh();
      }
    });

  return (
    <div className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          {user.name}
          {user.active ? <Pill tone="success">On</Pill> : <Pill>Off</Pill>}
        </p>
        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPwOpen(true)}
          className={`${btn} hover:border-foreground/30`}
        >
          <KeyRound className="h-4 w-4" /> Set password
        </button>
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className={
            user.active
              ? `${btn} text-muted-foreground hover:border-red-200 hover:bg-red-50 hover:text-red-700`
              : `${btn} border-green-200 text-green-700 hover:bg-green-50`
          }
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : user.active ? (
            <PowerOff className="h-4 w-4" />
          ) : (
            <Power className="h-4 w-4" />
          )}
          {user.active ? "Turn off" : "Turn on"}
        </button>
      </div>
      <SetPasswordDialog
        user={user}
        open={pwOpen}
        onClose={() => setPwOpen(false)}
      />
    </div>
  );
}

/** Admin: the carrier's portal logins (optional). Each can be turned on or off. */
export function CarrierLogins({
  carrierId,
  logins,
}: {
  carrierId: string;
  logins: User[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [v, setV] = useState({ name: "", email: "", password: "" });
  const [created, setCreated] = useState<typeof v | null>(null);

  const close = () => {
    setOpen(false);
    setCreated(null);
    setErrors({});
    setFormError(undefined);
    setV({ name: "", email: "", password: "" });
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(undefined);
    startTransition(async () => {
      const res = await createCarrierLoginAction({ carrierId, ...v });
      if (res.fieldErrors) setErrors(res.fieldErrors);
      else if (res.error) setFormError(res.error);
      else {
        setCreated(v);
        router.refresh();
      }
    });
  };

  const field = (k: "name" | "email", label: string, type = "text") => (
    <Field label={label} htmlFor={`cl-${k}`} error={errors[k]}>
      <Input
        id={`cl-${k}`}
        type={type}
        value={v[k]}
        autoComplete="off"
        onChange={(e) => {
          setV((s) => ({ ...s, [k]: e.target.value }));
          if (errors[k]) setErrors((x) => ({ ...x, [k]: "" }));
        }}
        aria-invalid={!!errors[k]}
        className="h-12 bg-white text-base"
      />
    </Field>
  );

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <LogIn className="h-5 w-5 text-primary" /> Carrier portal login
        </h2>
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(true)}
          className="h-9 px-3 text-sm font-semibold"
        >
          <Plus className="mr-1 h-4 w-4" /> Add login
        </Button>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Optional. The carrier sees only its own claims, can comment and upload
        documents. Turn a login off at any time.
      </p>
      {logins.length === 0 ? (
        <p className="text-sm text-muted-foreground">No login yet.</p>
      ) : (
        <div className="divide-y">
          {logins.map((u) => (
            <LoginRow key={u.id} user={u} />
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={close}
        title={created ? "Login created" : "Add carrier login"}
      >
        {created ? (
          <PasswordReveal
            name={created.name}
            email={created.email}
            password={created.password}
            onDone={close}
          />
        ) : (
          <form onSubmit={save} className="space-y-5" noValidate>
            <FormError message={formError} />
            {field("name", "Contact name")}
            {field("email", "Email", "email")}
            <PasswordField
              id="cl-password"
              label="Temporary password"
              value={v.password}
              onChange={(p) => {
                setV((s) => ({ ...s, password: p }));
                if (errors.password) setErrors((x) => ({ ...x, password: "" }));
              }}
              error={errors.password}
              hint="They must change it the first time they log in."
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={close}
                className="h-12 rounded-lg px-6 font-semibold text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <Button
                type="submit"
                disabled={pending}
                className="h-12 px-8 font-semibold"
              >
                {pending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Create login"
                )}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}
