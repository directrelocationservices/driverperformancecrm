// File: src/components/carriers/claim-status-pill.tsx
// (NEW file)

import { Pill } from "@/components/shared/pill";
import { CLAIM_STATUS_LABELS, type ClaimStatus } from "@/types";

const TONE: Record<ClaimStatus, "warning" | "primary" | "success" | "neutral"> =
  {
    open: "warning",
    submitted: "primary",
    paid: "success",
    closed: "neutral",
  };

export function ClaimStatusPill({ status }: { status: ClaimStatus }) {
  return <Pill tone={TONE[status]}>{CLAIM_STATUS_LABELS[status]}</Pill>;
}
