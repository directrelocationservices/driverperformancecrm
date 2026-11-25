// File: src/components/fleet/checklist-settings-form.tsx
// (REPLACE the whole file)

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/driver/form-bits";
import { SectionRow } from "@/components/shared/section-row";
import { saveChecklistAction } from "@/app/(admin)/admin/readiness-actions";
import { DEFAULT_CHECKLIST, type ChecklistItem } from "@/types";
import { cn } from "@/lib/utils";

type Row = ChecklistItem & { hint: string };

const toRows = (items: ChecklistItem[]): Row[] =>
  items.map((i) => ({ ...i, hint: i.hint ?? "" }));

const FLAGS: {
  key: "blocksTrip" | "ticket" | "scored";
  on: string;
  off: string;
  tone: string;
}[] = [
  {
    key: "blocksTrip",
    on: "No = trip on hold",
    off: "Doesn't hold trip",
    tone: "border-red-200 bg-red-50 text-red-700",
  },
  {
    key: "ticket",
    on: "No = repair ticket",
    off: "No ticket",
    tone: "border-amber-200 bg-amber-50 text-amber-800",
  },
  {
    key: "scored",
    on: "No = counts on score",
    off: "Not on score",
    tone: "border-blue-200 bg-blue-50 text-blue-700",
  },
];

/** Admin → Settings: the daily pre-trip checklist drivers answer Yes / No */
export function ChecklistSettingsForm({ items }: { items: ChecklistItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [rows, setRows] = useState<Row[]>(toRows(items));

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
      const res = await saveChecklistAction(
        rows
          .filter((r) => r.label.trim())
          .map((r) => ({
            ...r,
            label: r.label.trim(),
            hint: r.hint.trim() || undefined,
          })),
      );
      if (res.error) setError(res.error);
      else {
        toast.success(
          "Checklist saved. Drivers see it on their next pre-trip.",
        );
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={save} noValidate className="mt-8">
      <SectionRow
        title="Daily pre-trip checklist"
        description='Drivers answer Yes or No to each item. "No" always needs a note and a photo and emails all admins. Changes apply to new pre-trips; old ones keep what the driver saw.'
      >
        <FormError message={error} />
        <div className="mt-2 space-y-2">
          {rows.map((r, i) => (
            <div key={r.key} className="rounded-xl border bg-white p-3">
              <div className="flex items-start gap-2">
                <span className="mt-3 w-6 shrink-0 text-right text-sm font-semibold text-muted-foreground">
                  {i + 1}.
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <Input
                    value={r.label}
                    onChange={(e) => update(r.key, { label: e.target.value })}
                    placeholder="Item, e.g. Fire extinguisher charged and mounted"
                    aria-label="Item"
                    className="h-11 bg-white text-base"
                  />
                  <Input
                    value={r.hint}
                    onChange={(e) => update(r.key, { hint: e.target.value })}
                    placeholder="Short help text (optional)"
                    aria-label="Help text"
                    className="h-10 bg-white text-sm"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {FLAGS.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        aria-pressed={r[f.key]}
                        onClick={() =>
                          update(r.key, { [f.key]: !r[f.key] } as Partial<Row>)
                        }
                        className={cn(
                          "h-9 rounded-lg border px-3 text-xs font-semibold transition",
                          r[f.key]
                            ? f.tone
                            : "bg-white text-muted-foreground hover:border-foreground/30",
                        )}
                      >
                        {r[f.key] ? f.on : f.off}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label="Move up"
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={i === rows.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label="Move down"
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setRows((x) => x.filter((y) => y.key !== r.key))
                    }
                    aria-label="Remove item"
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setRows((x) => [
                  ...x,
                  {
                    key: `c${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
                    label: "",
                    hint: "",
                    blocksTrip: false,
                    ticket: false,
                    scored: false,
                  },
                ])
              }
              className="flex h-11 items-center gap-1.5 rounded-lg border border-dashed px-4 text-sm font-semibold text-foreground/80 hover:border-foreground/30"
            >
              <Plus className="h-4 w-4" /> Add item
            </button>
            <button
              type="button"
              onClick={() => setRows(toRows(DEFAULT_CHECKLIST))}
              className="flex h-11 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-muted-foreground hover:bg-muted"
            >
              <RotateCcw className="h-4 w-4" /> Reset to the default roadside
              items
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            type="submit"
            disabled={pending}
            className="h-11 px-8 font-semibold"
          >
            {pending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              "Save checklist"
            )}
          </Button>
        </div>
      </SectionRow>
    </form>
  );
}
