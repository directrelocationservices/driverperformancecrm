// File: src/components/admin/admin-job-form.tsx
// (NEW file)

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Field,
  FormError,
  FormSection,
  NativeSelect,
  Segmented,
} from "@/components/driver/form-bits";
import { FormActions } from "@/components/driver/form-actions";
import { US_STATES } from "@/lib/constants";
import { adminSaveJobAction } from "@/app/(admin)/admin/job-actions";
import { adminJobSchema, toFieldErrors } from "@/lib/validation/driver";
import { cn } from "@/lib/utils";
import type { Job } from "@/types";

type Tri = "yes" | "no" | "unknown";
const toBool = (t: Tri) => (t === "unknown" ? null : t === "yes");
const toTri = (b: boolean | null | undefined): Tri =>
  b == null ? "unknown" : b ? "yes" : "no";
const TRI_OPTIONS: { value: Tri; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unknown", label: "Not known" },
];

const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

type Option = { id: string; name: string };

/** Job logged by the office for a driver (new), or editing a job's details */
export function AdminJobForm({
  drivers,
  carriers,
  job,
  defaultDriverId,
  cancelHref,
}: {
  drivers: Option[];
  carriers: Option[];
  job?: Job;
  defaultDriverId?: string;
  cancelHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();

  const [values, setValues] = useState({
    driverId: job?.driverId ?? defaultDriverId ?? "",
    jobNumber: job?.jobNumber ?? "",
    customerName: job?.customerName ?? "",
    date: job?.date ?? today(),
    deliveryDate: job?.deliveryDate ?? "",
    originCity: job?.originCity ?? "",
    originState: job?.originState ?? "FL",
    destCity: job?.destCity ?? "",
    destState: job?.destState ?? "",
    carrierId: job?.carrierId ?? "",
  });
  const [crew, setCrew] = useState<string[]>(
    (job?.crewIds ?? []).filter((id) => id !== job?.driverId),
  );
  const [deliveredBy, setDeliveredBy] = useState<"drs" | "partner">(
    job?.deliveredBy ?? "drs",
  );
  const [pickup, setPickup] = useState<Tri>(toTri(job?.onTimePickup));
  const [delivery, setDelivery] = useState<Tri>(toTri(job?.onTimeDelivery));

  const set = (key: keyof typeof values, v: string) => {
    setValues((s) => ({ ...s, [key]: v }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  };
  const bind =
    (key: keyof typeof values) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      set(key, e.target.value);

  // A driver who left can still appear on an old job
  const crewOptions = drivers.filter((d) => d.id !== values.driverId);
  const toggleCrew = (id: string) =>
    setCrew((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(undefined);
    const payload = {
      ...values,
      id: job?.id,
      crewIds: crew.filter((id) => id !== values.driverId),
      deliveredBy,
      carrierId: deliveredBy === "partner" ? values.carrierId : "",
      onTimePickup: toBool(pickup),
      onTimeDelivery: toBool(delivery),
    };
    const check = adminJobSchema.safeParse(payload);
    if (!check.success) {
      setErrors(toFieldErrors(check.error));
      setFormError("Please fix the highlighted fields.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    startTransition(async () => {
      const res = await adminSaveJobAction(check.data);
      if (res.fieldErrors) {
        setErrors(res.fieldErrors);
        setFormError("Please fix the highlighted fields.");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (res.error || !res.id) {
        setFormError(res.error ?? "Couldn't save the job.");
        return;
      }
      toast.success(
        job
          ? "Job updated."
          : "Job added. It now counts in the driver's stats.",
      );
      router.push(`/admin/jobs/${res.id}`);
    });
  }

  const input = "h-12 bg-white text-base";
  const stateSelect = (key: "originState" | "destState") => (
    <NativeSelect
      id={key}
      value={values[key]}
      onChange={bind(key)}
      aria-invalid={!!errors[key]}
    >
      <option value="">—</option>
      {US_STATES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </NativeSelect>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError message={formError} />

      <FormSection title="Driver">
        <Field
          label="Driver"
          htmlFor="driverId"
          error={errors.driverId}
          hint="The job counts in this driver's stats."
        >
          <NativeSelect
            id="driverId"
            value={values.driverId}
            onChange={(e) => {
              set("driverId", e.target.value);
              setCrew((c) => c.filter((id) => id !== e.target.value));
            }}
            aria-invalid={!!errors.driverId}
          >
            <option value="">Select the driver</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Crew" hint="Everyone else who worked this job.">
          <div className="flex flex-wrap gap-2">
            {crewOptions.length === 0 && (
              <span className="text-sm text-muted-foreground">
                No other drivers.
              </span>
            )}
            {crewOptions.map((d) => {
              const active = crew.includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleCrew(d.id)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition",
                    active
                      ? "border-primary bg-primary text-white"
                      : "bg-white text-foreground/80 hover:border-foreground/30",
                  )}
                >
                  {active && <Check className="h-4 w-4" />}
                  {d.name}
                </button>
              );
            })}
          </div>
        </Field>
      </FormSection>

      <FormSection title="Job details">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Job number"
            htmlFor="jobNumber"
            error={errors.jobNumber}
          >
            <Input
              id="jobNumber"
              value={values.jobNumber}
              onChange={bind("jobNumber")}
              placeholder="e.g. 5444198"
              autoComplete="off"
              aria-invalid={!!errors.jobNumber}
              className={input}
            />
          </Field>
          <Field
            label="Customer name"
            htmlFor="customerName"
            error={errors.customerName}
            optional
          >
            <Input
              id="customerName"
              value={values.customerName}
              onChange={bind("customerName")}
              autoComplete="off"
              className={input}
            />
          </Field>
          <Field
            label="Pickup date"
            htmlFor="date"
            error={errors.date}
            hint="Past dates are fine."
          >
            <Input
              id="date"
              type="date"
              value={values.date}
              onChange={bind("date")}
              aria-invalid={!!errors.date}
              className={input}
            />
          </Field>
          <Field
            label="Delivery date"
            htmlFor="deliveryDate"
            error={errors.deliveryDate}
            optional
          >
            <Input
              id="deliveryDate"
              type="date"
              value={values.deliveryDate}
              onChange={bind("deliveryDate")}
              aria-invalid={!!errors.deliveryDate}
              className={input}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Pickup & delivery">
        <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3">
          <Field
            label="Pickup city"
            htmlFor="originCity"
            error={errors.originCity}
          >
            <Input
              id="originCity"
              value={values.originCity}
              onChange={bind("originCity")}
              autoComplete="off"
              aria-invalid={!!errors.originCity}
              className={input}
            />
          </Field>
          <Field label="State" htmlFor="originState" error={errors.originState}>
            {stateSelect("originState")}
          </Field>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3">
          <Field
            label="Delivery city"
            htmlFor="destCity"
            error={errors.destCity}
          >
            <Input
              id="destCity"
              value={values.destCity}
              onChange={bind("destCity")}
              autoComplete="off"
              aria-invalid={!!errors.destCity}
              className={input}
            />
          </Field>
          <Field label="State" htmlFor="destState" error={errors.destState}>
            {stateSelect("destState")}
          </Field>
        </div>
      </FormSection>

      <FormSection title="Delivery & timing">
        <Field label="Delivered by">
          <Segmented
            ariaLabel="Delivered by"
            value={deliveredBy}
            onChange={setDeliveredBy}
            options={[
              { value: "drs", label: "DRS crew" },
              { value: "partner", label: "Partner" },
            ]}
          />
        </Field>
        {deliveredBy === "partner" && (
          <Field
            label="Partner carrier"
            htmlFor="carrierId"
            error={errors.carrierId}
            optional
          >
            <NativeSelect
              id="carrierId"
              value={values.carrierId}
              onChange={bind("carrierId")}
            >
              <option value="">Not set</option>
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
        <Field label="Pickup on time?">
          <Segmented
            ariaLabel="Pickup on time"
            value={pickup}
            onChange={setPickup}
            options={TRI_OPTIONS}
          />
        </Field>
        <Field label="Delivery on time?">
          <Segmented
            ariaLabel="Delivery on time"
            value={delivery}
            onChange={setDelivery}
            options={TRI_OPTIONS}
          />
        </Field>
      </FormSection>

      <FormActions cancelHref={cancelHref} pending={pending}>
        {job ? "Save changes" : "Add job"}
      </FormActions>
    </form>
  );
}
