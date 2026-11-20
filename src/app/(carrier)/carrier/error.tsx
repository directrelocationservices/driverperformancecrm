// File: src/app/(carrier)/carrier/error.tsx
// (NEW file)

"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function CarrierError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} homeHref="/carrier" />;
}
