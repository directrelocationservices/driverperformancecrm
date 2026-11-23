// File: src/components/admin/offload-settings-form.tsx
// (NEW file)

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/driver/form-bits";
import { SectionRow } from "@/components/shared/section-row";
import { saveOffloadSettingsAction } from "@/app/(admin)/admin/offload-actions";
import { cn } from "@/lib/utils";
import type { OffloadForm } from "@/types";

type Row = { id?: string; key: string; name: string; required: boolean };

/** The paperwork drivers upload at offload, and who gets the alert */
export function OffloadSettingsForm({
  forms,
  alertEmails,
}: {
  forms: OffloadForm[];
  alertEmails: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [rows, setRows] = useState<Row[]>(
    forms
      .filter((f) => f.active)
      .map((f) => ({
        id: f.id,
        key: f.id,
        name: f.name,
        required: f.required,
      })),
  );
  const [emails, setEmails] = useState(alertEmails.join(", "));

  const update = (key: string, patch: Partial<Row>) =>
    setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const move = (i: number, by: number) =>
    setRows((r) => {
      const next = [...r];
      const [it] = next.splice(i, 1);
      next.splice(i + by, 0, it);
      return next;
    });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const res = await saveOffloadSettingsAction({
        forms: rows
          .filter((r) => r.name.trim())
          .map((r) => ({
            id: r.id,
            name: r.name,
            required: r.required,
            active: true,
          })),
        alertEmails: emails
          .split(/[\s,;]+/)
          .map((x) => x.trim())
          .filter(Boolean),
      });
      if (res.error) setError(res.error);
      else {
        toast.success("Offload settings saved");
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={save} noValidate className="mt-8">
      <SectionRow
        title="Offload paperwork"
        description="The forms drivers upload when they offload a job. Required forms must be added before the offload can be submitted. Removing a form doesn't change past offloads."
      >
        <FormError message={error} />
        <div className="mt-2 space-y-2">
          {rows.length === 0 && (
            <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              No forms. Drivers will only add photos.
            </p>
          )}
          {rows.map((r, i) => (
            <div
              key={r.key}
              className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-2.5 sm:flex-nowrap"
            >
              <Input
                value={r.name}
                onChange={(e) => update(r.key, { name: e.target.value })}
                placeholder="Form name, e.g. Bill of Lading"
                aria-label="Form name"
                className="h-11 min-w-0 flex-1 basis-full bg-white text-base sm:basis-auto"
              />
              <button
                type="button"
                onClick={() => update(r.key, { required: !r.required })}
                aria-pressed={r.required}
                className={cn(
                  "h-11 shrink-0 rounded-lg border px-3 text-sm font-semibold transition",
                  r.required
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "bg-white text-muted-foreground hover:border-foreground/30",
                )}
              >
                {r.required ? "Required" : "Optional"}
              </button>
              <div className="ml-auto flex shrink-0 gap-1">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  aria-label="Move up"
                  className="flex h-11 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={i === rows.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label="Move down"
                  className="flex h-11 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRows((x) => x.filter((y) => y.key !== r.key))
                  }
                  aria-label="Remove form"
                  className="flex h-11 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setRows((x) => [
                ...x,
                { key: crypto.randomUUID(), name: "", required: false },
              ])
            }
            className="flex h-11 items-center gap-1.5 rounded-lg border border-dashed px-4 text-sm font-semibold text-foreground/80 hover:border-foreground/30"
          >
            <Plus className="h-4 w-4" /> Add form
          </button>
        </div>

        <div className="mt-6">
          <Field
            label="Offload alert emails"
            htmlFor="off-emails"
            hint="Dispatch gets an email with photos, location and paperwork for every offload. Separate with commas. Leave empty to use the damage alert emails."
          >
            <Input
              id="off-emails"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="dispatch@example.com"
              className="h-12 bg-white text-base"
            />
          </Field>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            type="submit"
            disabled={pending}
            className="h-11 px-8 font-semibold"
          >
            {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save"}
          </Button>
        </div>
      </SectionRow>
    </form>
  );
}
