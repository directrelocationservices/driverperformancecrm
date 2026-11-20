// File: src/components/carriers/claim-edit.tsx
// (NEW file)

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Field,
  FormError,
  MoneyInput,
  NativeSelect,
  TEXTAREA_CLASS,
} from "@/components/driver/form-bits";
import {
  setClaimDeletedAction,
  updateClaimAction,
} from "@/app/(admin)/admin/carrier-actions";
import {
  CLAIM_STATUS_LABELS,
  type CarrierClaim,
  type ClaimStatus,
} from "@/types";

const STATUSES = Object.keys(CLAIM_STATUS_LABELS) as ClaimStatus[];
const str = (n: number) => String(n);

/** Admin: status, amounts and text of a claim */
export function ClaimEdit({ claim }: { claim: CarrierClaim }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const initial = {
    status: claim.status,
    claimAmount: str(claim.claimAmount),
    paidAmount: str(claim.paidAmount),
    chargedBackAmount: str(claim.chargedBackAmount),
    item: claim.item,
    description: claim.description,
  };
  const [v, setV] = useState(initial);
  const dirty = (Object.keys(v) as (keyof typeof v)[]).some(
    (k) => v[k] !== initial[k],
  );

  const set = (k: keyof typeof v, value: string) => {
    setV((s) => ({ ...s, [k]: value }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }));
  };
  const num = (s: string) => (s === "" ? NaN : Number(s));

  const save = () =>
    startTransition(async () => {
      setFormError(undefined);
      const res = await updateClaimAction({
        id: claim.id,
        status: v.status as ClaimStatus,
        item: v.item,
        description: v.description,
        claimAmount: num(v.claimAmount),
        paidAmount: num(v.paidAmount),
        chargedBackAmount: num(v.chargedBackAmount),
      });
      if (res.fieldErrors) setErrors(res.fieldErrors);
      else if (res.error) setFormError(res.error);
      else {
        toast.success("Claim saved. Changes are kept in the history.");
        router.refresh();
      }
    });

  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5">
      <h2 className="mb-4 text-lg font-bold">Claim status & amounts</h2>
      <FormError message={formError} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Status">
          <NativeSelect
            value={v.status}
            onChange={(e) => set("status", e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {CLAIM_STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Claim amount" error={errors.claimAmount}>
          <MoneyInput
            value={v.claimAmount}
            onChange={(x) => set("claimAmount", x)}
            invalid={!!errors.claimAmount}
          />
        </Field>
        <Field label="Paid to customer" error={errors.paidAmount}>
          <MoneyInput
            value={v.paidAmount}
            onChange={(x) => set("paidAmount", x)}
            invalid={!!errors.paidAmount}
          />
        </Field>
        <Field label="Charged back to carrier" error={errors.chargedBackAmount}>
          <MoneyInput
            value={v.chargedBackAmount}
            onChange={(x) => set("chargedBackAmount", x)}
            invalid={!!errors.chargedBackAmount}
          />
        </Field>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Field label="Item" error={errors.item}>
          <Input
            value={v.item}
            onChange={(e) => set("item", e.target.value)}
            aria-invalid={!!errors.item}
            className="h-12 bg-white text-base"
          />
        </Field>
        <Field
          label="What happened"
          error={errors.description}
          className="lg:col-span-2"
        >
          <textarea
            value={v.description}
            onChange={(e) => set("description", e.target.value)}
            aria-invalid={!!errors.description}
            className={TEXTAREA_CLASS}
          />
        </Field>
      </div>
      {dirty && (
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => {
              setV(initial);
              setErrors({});
            }}
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
      )}
    </section>
  );
}

export function ClaimDeleteButton({
  id,
  deleted,
}: {
  id: string;
  deleted: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const btn =
    "flex h-11 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold transition disabled:opacity-50";

  if (deleted)
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await setClaimDeletedAction(id, false);
            if (res.error) toast.error(res.error);
            else {
              toast.success("Claim restored.");
              router.refresh();
            }
          })
        }
        className={`${btn} hover:border-foreground/30`}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RotateCcw className="h-4 w-4" />
        )}{" "}
        Restore
      </button>
    );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${btn} text-muted-foreground hover:border-red-200 hover:bg-red-50 hover:text-red-700`}
      >
        <Trash2 className="h-4 w-4" /> Delete
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete this claim?"
        description="It's hidden from the carrier and the scorecard, but kept in the history. You can restore it."
        tone="danger"
        confirmLabel="Delete"
        onConfirm={async () => {
          const res = await setClaimDeletedAction(id, true);
          if (res.error) {
            toast.error(res.error);
            return false;
          }
          toast.success("Claim deleted.");
          router.refresh();
        }}
      />
    </>
  );
}
