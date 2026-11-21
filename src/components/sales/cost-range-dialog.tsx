// File: src/components/sales/cost-range-dialog.tsx
// (NEW file)

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/shared/modal";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Field,
  FormError,
  MoneyInput,
  NativeSelect,
  Segmented,
} from "@/components/driver/form-bits";
import {
  deleteCostRangeAction,
  saveCostRangeAction,
} from "@/app/(admin)/admin/cost-range-actions";
import type { CostRange, CostRangeMode } from "@/types";

type Source = { id: string; name: string };

const blank = (year = new Date().getFullYear()) => ({
  sourceId: "",
  startDate: `${year}-01-01`,
  endDate: "",
  mode: "per_lead" as CostRangeMode,
  amount: "",
  note: "",
});

/** Admin: set one cost for a whole date range (new, or edit an existing one) */
export function CostRangeDialog({
  sources,
  range,
}: {
  sources: Source[];
  range?: CostRange;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const initial = range
    ? {
        sourceId: range.sourceId,
        startDate: range.startDate,
        endDate: range.endDate,
        mode: range.mode,
        amount: String(range.amount),
        note: range.note ?? "",
      }
    : blank();
  const [v, setV] = useState(initial);

  const set = (k: keyof typeof v, value: string) => {
    setV((s) => ({ ...s, [k]: value }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }));
  };
  const close = () => {
    setOpen(false);
    setErrors({});
    setFormError(undefined);
    setV(initial);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(undefined);
    startTransition(async () => {
      const res = await saveCostRangeAction({
        id: range?.id,
        sourceId: v.sourceId,
        startDate: v.startDate,
        endDate: v.endDate,
        mode: v.mode,
        amount: v.amount === "" ? NaN : Number(v.amount),
        note: v.note,
      });
      if (res.fieldErrors) {
        setErrors(res.fieldErrors);
        setFormError("Please fix the highlighted fields.");
      } else if (res.error) setFormError(res.error);
      else {
        toast.success(
          range
            ? "Cost updated. The leads in this range now use it."
            : "Cost saved. Every lead in this range now uses it.",
        );
        setOpen(false);
        if (!range) setV(blank());
        router.refresh();
      }
    });
  };

  return (
    <>
      {range ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 text-sm font-semibold hover:border-foreground/30"
        >
          <Pencil className="h-4 w-4" /> Edit
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-11 items-center justify-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold hover:border-foreground/30"
        >
          <CalendarRange className="h-4 w-4" /> Cost for a date range
        </button>
      )}

      <Modal
        open={open}
        onClose={close}
        title={range ? "Edit date-range cost" : "Cost for a date range"}
      >
        <form onSubmit={save} className="space-y-5" noValidate>
          <p className="text-sm text-muted-foreground">
            Applies to every lead from the source in these dates and replaces
            the weekly cost there. Leads with a manual cost keep their own.
          </p>
          <FormError message={formError} />
          <Field label="Source" htmlFor="cr-source" error={errors.sourceId}>
            <NativeSelect
              id="cr-source"
              value={v.sourceId}
              onChange={(e) => set("sourceId", e.target.value)}
              aria-invalid={!!errors.sourceId}
            >
              <option value="">Select a source</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Start date"
              htmlFor="cr-start"
              error={errors.startDate}
            >
              <Input
                id="cr-start"
                type="date"
                value={v.startDate}
                onChange={(e) => set("startDate", e.target.value)}
                aria-invalid={!!errors.startDate}
                className="h-12 bg-white text-base"
              />
            </Field>
            <Field label="End date" htmlFor="cr-end" error={errors.endDate}>
              <Input
                id="cr-end"
                type="date"
                value={v.endDate}
                onChange={(e) => set("endDate", e.target.value)}
                aria-invalid={!!errors.endDate}
                className="h-12 bg-white text-base"
              />
            </Field>
          </div>
          <Field label="Cost type" error={errors.mode}>
            <Segmented
              value={v.mode}
              onChange={(m) => set("mode", m)}
              options={[
                { value: "per_lead", label: "Cost per lead" },
                { value: "total", label: "Total spend" },
              ]}
            />
          </Field>
          <Field
            label={
              v.mode === "per_lead"
                ? "Cost per lead"
                : "Total spent in these dates"
            }
            htmlFor="cr-amount"
            error={errors.amount}
            hint={
              v.mode === "total"
                ? "Divided equally across this source's leads in these dates (not test leads or leads with a manual cost). It updates when new leads come in."
                : undefined
            }
          >
            <MoneyInput
              id="cr-amount"
              value={v.amount}
              onChange={(x) => set("amount", x)}
              invalid={!!errors.amount}
            />
          </Field>
          <Field label="Note" htmlFor="cr-note" optional error={errors.note}>
            <Input
              id="cr-note"
              value={v.note}
              onChange={(e) => set("note", e.target.value)}
              placeholder="e.g. 2026 contract price"
              className="h-12 bg-white text-base"
            />
          </Field>
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
                "Save cost"
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function DeleteCostRangeButton({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 text-sm font-semibold text-muted-foreground hover:border-red-200 hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 className="h-4 w-4" /> Delete
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete this date-range cost?"
        description="Its leads go back to the weekly cost. The change stays in the history."
        tone="danger"
        confirmLabel="Delete"
        onConfirm={async () => {
          const res = await deleteCostRangeAction(id);
          if (res.error) {
            toast.error(res.error);
            return false;
          }
          toast.success("Date-range cost deleted.");
          router.refresh();
        }}
      />
    </>
  );
}
