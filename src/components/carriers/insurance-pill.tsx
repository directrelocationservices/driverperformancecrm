// File: src/components/carriers/insurance-pill.tsx
// (NEW file)

import { ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { Pill } from "@/components/shared/pill";
import type { InsuranceStatus } from "@/lib/carriers";

const plural = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

export function InsurancePill({ status }: { status: InsuranceStatus }) {
  switch (status.kind) {
    case "missing":
      return (
        <Pill tone="warning">
          <ShieldAlert className="h-3.5 w-3.5" /> No insurance on file
        </Pill>
      );
    case "expired":
      return (
        <Pill tone="danger">
          <ShieldX className="h-3.5 w-3.5" /> Insurance expired{" "}
          {status.days === 0 ? "today" : `${plural(status.days)} ago`}
        </Pill>
      );
    case "expiring":
      return (
        <Pill tone="warning">
          <ShieldAlert className="h-3.5 w-3.5" />{" "}
          {status.days === 0
            ? "Insurance expires today"
            : `Insurance expires in ${plural(status.days)}`}
        </Pill>
      );
    default:
      return (
        <Pill tone="success">
          <ShieldCheck className="h-3.5 w-3.5" /> Insured
        </Pill>
      );
  }
}
