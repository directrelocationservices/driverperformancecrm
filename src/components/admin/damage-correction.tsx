// File: src/components/admin/damage-correction.tsx
// (NEW file)

"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Field,
  FormError,
  MoneyInput,
  NativeSelect,
  TEXTAREA_CLASS,
} from "@/components/driver/form-bits";
import { correctDamageAction } from "@/app/(admin)/admin/actions";
import {
  DAMAGE_SOURCE_LABELS,
  type DamageIncident,
  type DamageSource,
} from "@/types";

const SOURCES = Object.keys(DAMAGE_SOURCE_LABELS) as DamageSource[];

export function DamageCorrection({ record }: { record: DamageIncident }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();

  const initial = {
    item: record.item,
    description: record.description,
    damageDate: record.damageDate ?? "",
    source: (record.source ?? "driver") as DamageSource,
    claimFiled: record.claimFiled ? "yes" : "no",
    estimatedCost: String(record.estimatedCost),
    reason: "",
  };
  const [v, setV] = useState(initial);

  const set = (k: keyof typeof v, value: string) => {
    setV((s) => ({ ...s, [k]: value }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: "" }));
  };

  const cancel = () => {
    setV(initial);
    setErrors({});
    setFormError(undefined);
    setOpen(false);
  };

  const save = () => {
    setFormError(undefined);
    startTransition(async () => {
      const res = await correctDamageAction({
        id: record.id,
        item: v.item,
        description: v.description,
        damageDate: v.damageDate || null,
        source: v.source,
        claimFiled: v.claimFiled === "yes",
        estimatedCost: v.estimatedCost === "" ? NaN : Number(v.estimatedCost),
        reason: v.reason,
      });
      if (res?.fieldErrors) setErrors(res.fieldErrors);
      else if (res?.error) setFormError(res.error);
      else {
        setV((s) => ({ ...s, reason: "" }));
        setOpen(false);
        toast.success("Damage corrected. The original is kept in the history.");
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border bg-white px-3 text-sm font-semibold text-foreground transition hover:border-foreground/30"
      >
        <Pencil className="h-4 w-4" />{" "}
        <span className="hidden sm:inline">Edit</span>
      </button>
    );
  }

  return (
    <div className="mt-4 w-full basis-full space-y-4 rounded-xl border-2 border-primary/30 bg-primary/[0.03] p-4">
      <div>
        <p className="font-semibold">Edit this damage</p>
        <p className="text-sm text-muted-foreground">
          Photos can&apos;t be changed. The original values are kept in the
          history.
        </p>
      </div>
      <FormError message={formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Item" error={errors.item}>
          <Input
            value={v.item}
            onChange={(e) => set("item", e.target.value)}
            aria-invalid={!!errors.item}
            className="h-11 bg-white text-base"
          />
        </Field>
        <Field label="Date of damage" error={errors.damageDate}>
          <Input
            type="date"
            value={v.damageDate}
            onChange={(e) => set("damageDate", e.target.value)}
            aria-invalid={!!errors.damageDate}
            className="h-11 bg-white text-base"
          />
        </Field>
      </div>
      <Field label="Description" error={errors.description}>
        <textarea
          value={v.description}
          onChange={(e) => set("description", e.target.value)}
          aria-invalid={!!errors.description}
          className={TEXTAREA_CLASS}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Source" error={errors.source}>
          <NativeSelect
            value={v.source}
            onChange={(e) => set("source", e.target.value)}
            className="h-11"
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {DAMAGE_SOURCE_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Claim filed" error={errors.claimFiled}>
          <NativeSelect
            value={v.claimFiled}
            onChange={(e) => set("claimFiled", e.target.value)}
            className="h-11"
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </NativeSelect>
        </Field>
        <Field label="Estimated cost" error={errors.estimatedCost}>
          <MoneyInput
            value={v.estimatedCost}
            onChange={(val) => set("estimatedCost", val)}
            invalid={!!errors.estimatedCost}
          />
        </Field>
      </div>
      <Field label="Reason for the change" error={errors.reason}>
        <Input
          value={v.reason}
          onChange={(e) => set("reason", e.target.value)}
          placeholder="e.g. Final repair cost from the claim"
          aria-invalid={!!errors.reason}
          className="h-11 bg-white text-base"
        />
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={cancel}
          className="h-11 rounded-lg px-5 text-sm font-semibold text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
        <Button
          type="button"
          onClick={save}
          disabled={pending}
          className="h-11 px-6 font-semibold"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </div>
    </div>
  );
}
