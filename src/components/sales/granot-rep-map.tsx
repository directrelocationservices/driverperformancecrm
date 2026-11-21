// File: src/components/sales/granot-rep-map.tsx
// (REPLACE the whole file)

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Pill } from "@/components/shared/pill";
import { saveGranotNameAction } from "@/app/(admin)/admin/granot-actions";

/** One row per sales rep (and admin): their username in Granot */
export function GranotRepMap({
  reps,
}: {
  reps: { id: string; name: string; granotName: string; isAdmin?: boolean }[];
}) {
  if (!reps.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No active sales reps yet. Add them under Users.
      </p>
    );
  }
  return (
    <ul className="divide-y">
      {reps.map((r) => (
        <RepRow key={r.id} rep={r} />
      ))}
    </ul>
  );
}

function RepRow({
  rep,
}: {
  rep: { id: string; name: string; granotName: string; isAdmin?: boolean };
}) {
  const router = useRouter();
  const [value, setValue] = useState(rep.granotName);
  const [pending, startTransition] = useTransition();
  const changed = value.trim() !== rep.granotName;

  const save = () =>
    startTransition(async () => {
      const res = await saveGranotNameAction(rep.id, value);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.linked
          ? `Saved. ${res.linked} lead${res.linked === 1 ? "" : "s"} linked to ${rep.name}.`
          : "Saved",
      );
      router.refresh();
    });

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
      <p className="flex min-w-0 items-center gap-2 font-semibold sm:w-48 sm:shrink-0">
        <span className="truncate">{rep.name}</span>
        {rep.isAdmin && <Pill>Admin</Pill>}
      </p>
      <div className="flex min-w-0 flex-1 gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && changed) {
              e.preventDefault();
              save();
            }
          }}
          placeholder="Granot username"
          aria-label={`${rep.name}'s Granot username`}
          className="h-10 min-w-0 flex-1 bg-white"
        />
        <button
          type="button"
          onClick={save}
          disabled={!changed || pending}
          className="flex h-10 w-20 shrink-0 items-center justify-center rounded-lg bg-secondary text-sm font-semibold text-white disabled:opacity-40"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </button>
      </div>
    </li>
  );
}
