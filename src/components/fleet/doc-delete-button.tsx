// File: src/components/fleet/doc-delete-button.tsx
// (NEW file)

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteDocumentAction } from "@/app/(admin)/admin/readiness-actions";

/** Admin: remove a document uploaded by mistake (tap twice to confirm) */
export function DocDeleteButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      const res = await deleteDocumentAction(id);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`${label} removed`);
        router.refresh();
      }
      setConfirm(false);
    });

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => (confirm ? run() : setConfirm(true))}
      onBlur={() => setConfirm(false)}
      aria-label={`Remove ${label}`}
      className={
        confirm
          ? "flex h-8 items-center gap-1 rounded-lg bg-red-600 px-2.5 text-xs font-semibold text-white"
          : "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-700"
      }
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : confirm ? (
        "Remove?"
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </button>
  );
}
