// File: src/components/fleet/hold-clear.tsx
// (NEW file)

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { clearHoldAction } from "@/app/(admin)/admin/readiness-actions";

/** Admin: clear a trip hold once the driver fixed it */
export function HoldClear({ preTripId }: { preTripId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(undefined);
      const res = await clearHoldAction(preTripId, note);
      if (res.fieldErrors?.note) setError(res.fieldErrors.note);
      else if (res.error) setError(res.error);
      else {
        toast.success("Hold cleared. The driver can start the trip.");
        setNote("");
        router.refresh();
      }
    });

  return (
    <div className="mt-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setError(undefined);
          }}
          placeholder="What was done, e.g. Driver showed new log sheets"
          aria-invalid={!!error}
          aria-label="Note"
          className="h-11 flex-1 bg-white"
        />
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-green-700 px-4 text-sm font-semibold text-white transition hover:bg-green-800 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Clear hold
        </button>
      </div>
      {error && (
        <p className="mt-1.5 text-sm font-medium text-destructive">{error}</p>
      )}
    </div>
  );
}
