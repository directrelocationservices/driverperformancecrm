// File: src/components/admin/admin-damage-form.tsx
// (REPLACE the whole file)

"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Headset } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Field,
  FormError,
  FormSection,
  MoneyInput,
  NativeSelect,
  Segmented,
  TEXTAREA_CLASS,
} from "@/components/driver/form-bits";
import { PhotoPicker } from "@/components/driver/photo-picker";
import { FormActions } from "@/components/driver/form-actions";
import { adminCreateDamageAction } from "@/app/(admin)/admin/actions";
import {
  adminDamageSchema,
  DAMAGE_SOURCES,
  MAX_ADMIN_DAMAGE_PHOTOS,
  toFieldErrors,
} from "@/lib/validation/driver";
import { OfflineUploadError, prepareEvidence } from "@/lib/evidence/upload";
import {
  DAMAGE_ATTRIBUTION_LABELS,
  DAMAGE_SOURCE_LABELS,
  type DamageAttribution,
} from "@/types";

type Option = { id: string; name: string };

type YesNo = "yes" | "no" | "";
export type DamageJobOption = {
  id: string;
  jobNumber: string;
  date: string;
  partner: boolean;
  /** Driver first, then the rest of the crew */
  crew: Option[];
  carrierId?: string | null;
};

const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Damage added by an admin, from the driver profile or from a job */
export function AdminDamageForm({
  jobs,
  fixedJobId,
  cancelHref,
  admins,
  currentAdminId,
  carriers,
}: {
  jobs: DamageJobOption[];
  fixedJobId?: string;
  cancelHref: string;
  /** Who can be "Reported by" */
  admins: Option[];
  currentAdminId: string;
  carriers: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  // Same key on a retry, so photos already uploaded are reused
  const key = useRef(`admin-${crypto.randomUUID()}`);

  const fixed = jobs.find((j) => j.id === fixedJobId);
  const [jobNumber, setJobNumber] = useState(fixed?.jobNumber ?? "");
  const [damageDate, setDamageDate] = useState(today());
  const [source, setSource] = useState<string>("");
  const [item, setItem] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [claim, setClaim] = useState<YesNo>("");
  const [cost, setCost] = useState("");
  const [reportedOn, setReportedOn] = useState(today());
  const [reportedBy, setReportedBy] = useState(
    admins.some((a) => a.id === currentAdminId) ? currentAdminId : "",
  );
  const [attributedTo, setAttributedTo] = useState<DamageAttribution | "">("");
  const [driverId, setDriverId] = useState("");
  const [carrierId, setCarrierId] = useState("");

  const byNumber = useMemo(
    () => new Map(jobs.map((j) => [j.jobNumber.trim().toLowerCase(), j])),
    [jobs],
  );
  const job = fixed ?? byNumber.get(jobNumber.trim().toLowerCase());

  // Pick sensible defaults for the chosen job
  const chooseAttribution = (v: DamageAttribution) => {
    setAttributedTo(v);
    clear("attributedTo");
    if (v === "carrier") {
      if (!carrierId && job?.carrierId) setCarrierId(job.carrierId);
    } else if (!driverId && job?.crew[0]) {
      setDriverId(job.crew[0].id);
    }
  };

  const clear = (k: string) =>
    errors[k] && setErrors((e) => ({ ...e, [k]: "" }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(undefined);
    const payload = {
      jobId: job?.id ?? "",
      damageDate,
      source,
      item,
      description,
      photos,
      claimFiled: claim === "" ? undefined : claim === "yes",
      estimatedCost: cost === "" ? undefined : Number(cost),
      reportedOn,
      reportedBy,
      attributedTo,
      attributedDriverId:
        attributedTo && attributedTo !== "carrier" ? driverId : undefined,
      carrierId: attributedTo === "carrier" ? carrierId : undefined,
    };

    const check = adminDamageSchema.safeParse(payload);
    if (!check.success) {
      const fe = toFieldErrors(check.error);
      if (fe.jobId)
        fe.jobNumber = jobNumber.trim()
          ? "This job number isn't in this driver's jobs"
          : "Enter the job number";
      setErrors(fe);
      setFormError("Please fix the highlighted fields.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    startTransition(async () => {
      try {
        const ready = await prepareEvidence("damage", payload, key.current);
        const res = await adminCreateDamageAction(ready);
        if (res.fieldErrors) {
          setErrors(res.fieldErrors);
          setFormError("Please fix the highlighted fields.");
          return;
        }
        if (res.error) {
          setFormError(res.error);
          return;
        }
        toast.success(
          attributedTo === "carrier"
            ? "Damage added. It now counts in the carrier's score."
            : "Damage added. It now counts in the driver's stats.",
        );
        router.push(`/admin/jobs/${res.jobId}`);
      } catch (err) {
        setFormError(
          err instanceof OfflineUploadError
            ? "No connection. Please try again when you're online."
            : "Photos couldn't be uploaded. Please try again.",
        );
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        <Headset className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          This damage will be tagged <b>Reported by customer service</b>, so
          it&apos;s easy to tell apart from damage logged by the crew. It counts
          against the driver or carrier you attribute it to.
        </p>
      </div>

      <FormError message={formError} />

      <FormSection title="Job & source">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Job number"
            htmlFor="jobNumber"
            error={errors.jobNumber}
            hint={
              fixed
                ? undefined
                : job
                  ? `Job date ${job.date}`
                  : "Type or pick one of this driver's jobs"
            }
          >
            <Input
              id="jobNumber"
              list="damage-job-numbers"
              value={jobNumber}
              disabled={!!fixed}
              onChange={(e) => {
                setJobNumber(e.target.value);
                clear("jobNumber");
              }}
              placeholder="e.g. 5444198"
              aria-invalid={!!errors.jobNumber}
              className="h-12 bg-white text-base"
            />
            {!fixed && (
              <datalist id="damage-job-numbers">
                {jobs.map((j) => (
                  <option key={j.id} value={j.jobNumber}>
                    {j.date}
                  </option>
                ))}
              </datalist>
            )}
          </Field>
          <Field
            label="Date of damage"
            htmlFor="damageDate"
            error={errors.damageDate}
          >
            <Input
              id="damageDate"
              type="date"
              value={damageDate}
              onChange={(e) => {
                setDamageDate(e.target.value);
                clear("damageDate");
              }}
              aria-invalid={!!errors.damageDate}
              className="h-12 bg-white text-base"
            />
          </Field>
        </div>
        <Field label="Source" htmlFor="source" error={errors.source}>
          <NativeSelect
            id="source"
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              clear("source");
            }}
            aria-invalid={!!errors.source}
          >
            <option value="">Select where this came from</option>
            {DAMAGE_SOURCES.map((s) => (
              <option key={s} value={s}>
                {DAMAGE_SOURCE_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </FormSection>

      <FormSection title="Report">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Date reported"
            htmlFor="reportedOn"
            error={errors.reportedOn}
          >
            <Input
              id="reportedOn"
              type="date"
              value={reportedOn}
              onChange={(e) => {
                setReportedOn(e.target.value);
                clear("reportedOn");
              }}
              aria-invalid={!!errors.reportedOn}
              className="h-12 bg-white text-base"
            />
          </Field>
          <Field
            label="Reported by"
            htmlFor="reportedBy"
            error={errors.reportedBy}
          >
            <NativeSelect
              id="reportedBy"
              value={reportedBy}
              onChange={(e) => {
                setReportedBy(e.target.value);
                clear("reportedBy");
              }}
              aria-invalid={!!errors.reportedBy}
            >
              <option value="">Select the admin</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Attributed to"
        description="Who this damage counts against."
      >
        <Field label="Attributed to" error={errors.attributedTo}>
          <Segmented
            ariaLabel="Attributed to"
            value={attributedTo}
            onChange={(v) => v && chooseAttribution(v)}
            options={(
              Object.keys(DAMAGE_ATTRIBUTION_LABELS) as DamageAttribution[]
            ).map((k): { value: DamageAttribution | ""; label: string } => ({
              value: k,
              label: DAMAGE_ATTRIBUTION_LABELS[k],
            }))}
          />
        </Field>
        {attributedTo && attributedTo !== "carrier" && (
          <Field
            label={
              attributedTo === "pickup" ? "Pickup driver" : "Delivery driver"
            }
            htmlFor="attributedDriverId"
            error={errors.attributedDriverId}
            hint={job ? undefined : "Choose the job first"}
          >
            <NativeSelect
              id="attributedDriverId"
              value={driverId}
              onChange={(e) => {
                setDriverId(e.target.value);
                clear("attributedDriverId");
              }}
              aria-invalid={!!errors.attributedDriverId}
            >
              <option value="">Select the driver</option>
              {(job?.crew ?? []).map((c, i) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {i === 0 ? " (driver)" : " (crew)"}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
        {attributedTo === "carrier" && (
          <Field
            label="Partner carrier"
            htmlFor="carrierId"
            error={errors.carrierId}
          >
            <NativeSelect
              id="carrierId"
              value={carrierId}
              onChange={(e) => {
                setCarrierId(e.target.value);
                clear("carrierId");
              }}
              aria-invalid={!!errors.carrierId}
            >
              <option value="">Choose the carrier</option>
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
      </FormSection>

      <FormSection title="What was damaged">
        <Field label="Item" htmlFor="item" error={errors.item}>
          <Input
            id="item"
            value={item}
            onChange={(e) => {
              setItem(e.target.value);
              clear("item");
            }}
            placeholder="e.g. Dining table"
            aria-invalid={!!errors.item}
            className="h-12 bg-white text-base"
          />
        </Field>
        <Field
          label="Description"
          htmlFor="description"
          error={errors.description}
        >
          <textarea
            id="description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              clear("description");
            }}
            placeholder="e.g. Customer called: scratch on the table top after delivery"
            aria-invalid={!!errors.description}
            className={TEXTAREA_CLASS}
          />
        </Field>
      </FormSection>

      <FormSection
        title="Photos"
        description={`Optional, up to ${MAX_ADMIN_DAMAGE_PHOTOS}.`}
      >
        <Field label="Damage photos" error={errors.photos}>
          <PhotoPicker
            value={photos}
            onChange={(p) => {
              setPhotos(p);
              clear("photos");
            }}
            max={MAX_ADMIN_DAMAGE_PHOTOS}
            invalid={!!errors.photos}
          />
        </Field>
      </FormSection>

      <FormSection title="Claim & cost">
        <Field label="Customer claim filed?" error={errors.claimFiled}>
          <Segmented
            ariaLabel="Customer claim filed"
            value={claim}
            onChange={(v) => {
              setClaim(v);
              clear("claimFiled");
            }}
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
          />
        </Field>
        <Field
          label="Estimated cost"
          htmlFor="cost"
          error={errors.estimatedCost}
        >
          <MoneyInput
            id="cost"
            value={cost}
            onChange={(v) => {
              setCost(v);
              clear("estimatedCost");
            }}
            invalid={!!errors.estimatedCost}
          />
        </Field>
      </FormSection>

      <FormActions cancelHref={cancelHref} pending={pending}>
        Add damage
      </FormActions>
    </form>
  );
}
