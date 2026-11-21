// File: src/components/admin/sales-settings-form.tsx
// (NEW file)

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, Segmented } from "@/components/driver/form-bits";
import { SectionRow } from "@/components/shared/section-row";
import { updateSalesSettingsAction } from "@/app/(admin)/admin/sales-settings-actions";
import type { SalesSettings } from "@/types";

export function SalesSettingsForm({ settings }: { settings: SalesSettings }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [minLeads, setMinLeads] = useState(
    String(settings.leaderboardMinLeads),
  );
  const [repsSee, setRepsSee] = useState<"yes" | "no">(
    settings.repsSeeLeaderboard ? "yes" : "no",
  );

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const res = await updateSalesSettingsAction({
        leaderboardMinLeads: minLeads === "" ? NaN : Number(minLeads),
        repsSeeLeaderboard: repsSee === "yes",
      });
      if (res.fieldErrors) setError(Object.values(res.fieldErrors)[0]);
      else if (res.error) toast.error(res.error);
      else {
        toast.success("Sales leaderboard settings saved");
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={save} noValidate className="mt-8">
      <SectionRow
        title="Sales leaderboard"
        description="Who ranks on Close %, and whether sales reps can see the leaderboard from their own login."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Minimum leads for Close %"
            htmlFor="ss-min"
            hint="A rep needs at least this many leads in the period to rank on Close %"
            error={error}
          >
            <Input
              id="ss-min"
              inputMode="numeric"
              value={minLeads}
              onChange={(e) =>
                setMinLeads(e.target.value.replace(/[^0-9]/g, ""))
              }
              aria-invalid={!!error}
              className="h-12 bg-white text-base tabular-nums"
            />
          </Field>
          <Field label="Reps can see the leaderboard">
            <Segmented
              ariaLabel="Reps can see the leaderboard"
              value={repsSee}
              onChange={setRepsSee}
              options={[
                { value: "yes", label: "On" },
                { value: "no", label: "Off" },
              ]}
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
