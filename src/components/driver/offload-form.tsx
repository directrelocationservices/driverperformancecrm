// File: src/components/driver/offload-form.tsx
// (NEW file)

"use client";

import { useRef, useState, useTransition } from "react";
import {
  AlertCircle,
  Building2,
  Camera,
  CheckCircle2,
  FileText,
  Handshake,
  Home,
  Loader2,
  Lock,
  MapPin,
  MoreHorizontal,
  Paperclip,
  RefreshCw,
  Warehouse,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Field,
  FormError,
  FormSection,
  NativeSelect,
  TEXTAREA_CLASS,
} from "./form-bits";
import { PhotoPicker } from "./photo-picker";
import { useGeolocation } from "@/hooks/use-geolocation";
import { compressImage } from "@/lib/image";
import { createOffloadAction } from "@/app/(driver)/driver/actions";
import {
  MAX_FORM_PAGES,
  MAX_OFFLOAD_PHOTOS,
  MIN_OFFLOAD_PHOTOS,
  offloadSchema,
} from "@/lib/validation/driver";
import { openOfflinePath, submitOrQueue } from "@/lib/offline/submit";
import { cn } from "@/lib/utils";
import { OFFLOAD_DESTINATION_LABELS, type OffloadDestination } from "@/types";

const MAX_PDF_BYTES = 10 * 1024 * 1024;

const WHERE: { value: OffloadDestination; icon: React.ElementType }[] = [
  { value: "customer", icon: Home },
  { value: "warehouse", icon: Warehouse },
  { value: "storage", icon: Building2 },
  { value: "carrier", icon: Handshake },
  { value: "other", icon: MoreHorizontal },
];

type FormDef = { id: string; name: string; required: boolean };

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

/** One paperwork form: pages by camera, photo or PDF */
function FormSlot({
  form,
  pages,
  onChange,
  invalid,
}: {
  form: FormDef;
  pages: string[];
  onChange: (pages: string[]) => void;
  invalid: boolean;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const left = MAX_FORM_PAGES - pages.length;
  const done = pages.length > 0;

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const out: string[] = [];
      for (const f of Array.from(files).slice(0, left)) {
        if (f.type === "application/pdf") {
          if (f.size > MAX_PDF_BYTES) {
            toast.error(`${f.name} is too large (max 10 MB).`);
            continue;
          }
          out.push(await readAsDataUrl(f));
        } else if (f.type.startsWith("image/")) {
          out.push(await compressImage(f));
        } else {
          toast.error(`${f.name}: upload a photo or a PDF.`);
        }
      }
      onChange([...pages, ...out]);
    } catch {
      toast.error("A page couldn't be read. Please try again.");
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        done
          ? "border-green-200 bg-green-50/60"
          : invalid && form.required
            ? "border-destructive bg-red-50/50"
            : "bg-white",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {done ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
          ) : (
            <AlertCircle
              className={cn(
                "h-5 w-5 shrink-0",
                form.required ? "text-destructive" : "text-amber-500",
              )}
            />
          )}
          <p className="truncate font-semibold">{form.name}</p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-bold",
            done
              ? "bg-green-100 text-green-800"
              : form.required
                ? "bg-red-100 text-red-700"
                : "bg-amber-100 text-amber-800",
          )}
        >
          {done
            ? `${pages.length} page${pages.length > 1 ? "s" : ""}`
            : form.required
              ? "Required · missing"
              : "Missing"}
        </span>
      </div>

      {pages.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {pages.map((p, i) => (
            <div
              key={i}
              className="relative overflow-hidden rounded-lg border bg-muted"
            >
              {p.startsWith("data:application/pdf") ? (
                <div className="flex aspect-[3/4] flex-col items-center justify-center gap-1 text-xs font-semibold text-muted-foreground">
                  <FileText className="h-6 w-6" /> PDF
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p}
                  alt={`${form.name} page ${i + 1}`}
                  className="aspect-[3/4] w-full object-cover"
                />
              )}
              <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 text-[11px] font-bold text-white">
                {i + 1}
              </span>
              <button
                type="button"
                onClick={() => onChange(pages.filter((_, x) => x !== i))}
                aria-label={`Remove page ${i + 1}`}
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {left > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
            className="flex h-12 items-center justify-center gap-2 rounded-lg bg-secondary text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {pages.length ? "Add page" : "Take photo"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="flex h-12 items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input bg-white text-sm font-semibold text-foreground/80 transition active:scale-[0.98] disabled:opacity-60"
          >
            <Paperclip className="h-4 w-4" /> Photo or PDF
          </button>
        </div>
      )}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => add(e.target.files)}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => add(e.target.files)}
      />
    </div>
  );
}

export function OffloadForm({
  jobId,
  carriers,
  forms,
}: {
  jobId: string;
  carriers: { id: string; name: string }[];
  forms: FormDef[];
}) {
  const geo = useGeolocation();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();

  const [destination, setDestination] = useState<OffloadDestination | "">("");
  const [storageFacility, setStorageFacility] = useState("");
  const [storageAddress, setStorageAddress] = useState("");
  const [storageUnit, setStorageUnit] = useState("");
  const [carrierId, setCarrierId] = useState("");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [pages, setPages] = useState<Record<string, string[]>>({});

  const clear = (k: string) =>
    errors[k] && setErrors((e) => ({ ...e, [k]: "" }));

  const missing = forms.filter((f) => !pages[f.id]?.length);
  const missingRequired = missing.filter((f) => f.required);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(undefined);
    const payload = {
      jobId,
      destination,
      storageFacility,
      storageAddress,
      storageUnit,
      carrierId,
      note,
      photos,
      forms: forms.map((f) => ({
        formId: f.id,
        name: f.name,
        required: f.required,
        pages: pages[f.id] ?? [],
      })),
      capturedAtDevice: new Date().toISOString(),
      lat: geo.lat,
      lng: geo.lng,
      accuracy: geo.accuracy,
    };

    startTransition(async () => {
      const res = await submitOrQueue({
        type: "offload",
        schema: offloadSchema,
        payload,
        jobRef: jobId,
        label: `Offload: ${destination ? OFFLOAD_DESTINATION_LABELS[destination] : "job"}`,
        online: (data) => createOffloadAction(data),
        afterQueue: () => {
          toast.success(
            "Offload saved on this phone. It will upload and alert dispatch when you're back online.",
          );
          openOfflinePath(`/driver/jobs/${jobId}`);
        },
      });
      if (res?.fieldErrors) {
        setErrors(res.fieldErrors);
        setFormError(
          res.fieldErrors.forms ?? "Please fix the highlighted fields.",
        );
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      if (res?.error) setFormError(res.error);
    });
  }

  const input = "h-12 bg-white text-base";

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {/* GPS status */}
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm",
          geo.status === "ok" && "border-green-200 bg-green-50 text-green-800",
          geo.status === "error" &&
            "border-amber-200 bg-amber-50 text-amber-800",
          (geo.status === "loading" || geo.status === "idle") &&
            "bg-card text-muted-foreground",
        )}
      >
        {geo.status === "loading" || geo.status === "idle" ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
        ) : (
          <MapPin className="h-5 w-5 shrink-0" />
        )}
        <p className="min-w-0 flex-1 font-medium">
          {geo.status === "ok" &&
            `Location captured (±${geo.accuracy}m). The address is added automatically.`}
          {geo.status === "error" && `${geo.message}. You can still submit.`}
          {(geo.status === "loading" || geo.status === "idle") &&
            "Getting your location…"}
        </p>
        {geo.status === "error" && (
          <button
            type="button"
            onClick={geo.request}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 font-semibold text-foreground shadow-sm"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        )}
      </div>

      <FormError message={formError} />

      <FormSection title="Where was it offloaded?">
        <Field label="Offloaded at" error={errors.destination}>
          <div className="grid gap-2 sm:grid-cols-2">
            {WHERE.map(({ value, icon: Icon }) => {
              const active = destination === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setDestination(value);
                    clear("destination");
                  }}
                  className={cn(
                    "flex h-14 items-center gap-3 rounded-xl border px-4 text-left text-[15px] font-semibold transition active:scale-[0.99]",
                    active
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "bg-white hover:border-foreground/30",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 shrink-0",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  {OFFLOAD_DESTINATION_LABELS[value]}
                </button>
              );
            })}
          </div>
        </Field>

        {destination === "storage" && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Facility name"
              htmlFor="storageFacility"
              error={errors.storageFacility}
            >
              <Input
                id="storageFacility"
                value={storageFacility}
                onChange={(e) => {
                  setStorageFacility(e.target.value);
                  clear("storageFacility");
                }}
                placeholder="e.g. Public Storage"
                aria-invalid={!!errors.storageFacility}
                className={input}
              />
            </Field>
            <Field
              label="Unit number"
              htmlFor="storageUnit"
              error={errors.storageUnit}
            >
              <Input
                id="storageUnit"
                value={storageUnit}
                onChange={(e) => {
                  setStorageUnit(e.target.value);
                  clear("storageUnit");
                }}
                placeholder="e.g. B-214"
                aria-invalid={!!errors.storageUnit}
                className={input}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field
                label="Facility address"
                htmlFor="storageAddress"
                error={errors.storageAddress}
              >
                <Input
                  id="storageAddress"
                  value={storageAddress}
                  onChange={(e) => {
                    setStorageAddress(e.target.value);
                    clear("storageAddress");
                  }}
                  placeholder="Street, city, state"
                  aria-invalid={!!errors.storageAddress}
                  className={input}
                />
              </Field>
            </div>
          </div>
        )}

        {destination === "carrier" && (
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

        <Field
          label={destination === "other" ? "Where was it offloaded?" : "Note"}
          htmlFor="note"
          error={errors.note}
          optional={destination !== "other"}
        >
          <textarea
            id="note"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              clear("note");
            }}
            placeholder={
              destination === "other"
                ? "Describe the place"
                : "Anything dispatch should know"
            }
            aria-invalid={!!errors.note}
            className={TEXTAREA_CLASS}
          />
        </Field>
      </FormSection>

      <FormSection
        title="Photos of the offloaded goods"
        description={`At least ${MIN_OFFLOAD_PHOTOS} photos, up to ${MAX_OFFLOAD_PHOTOS}.`}
      >
        <Field label="Photos" error={errors.photos}>
          <PhotoPicker
            value={photos}
            onChange={(p) => {
              setPhotos(p);
              clear("photos");
            }}
            max={MAX_OFFLOAD_PHOTOS}
            invalid={!!errors.photos}
          />
        </Field>
      </FormSection>

      {forms.length > 0 && (
        <FormSection
          title="Paperwork"
          description="Add every page of each form. Photos or PDFs."
        >
          {missing.length > 0 ? (
            <p
              className={cn(
                "flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm font-medium",
                missingRequired.length
                  ? "bg-red-50 text-red-700"
                  : "bg-amber-50 text-amber-800",
              )}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              Missing: {missing.map((f) => f.name).join(", ")}
              {missingRequired.length > 0 &&
                " (required forms must be added to submit)"}
            </p>
          ) : (
            <p className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2.5 text-sm font-medium text-green-800">
              <CheckCircle2 className="h-4 w-4" /> All forms added
            </p>
          )}
          <div className="space-y-3">
            {forms.map((f) => (
              <FormSlot
                key={f.id}
                form={f}
                pages={pages[f.id] ?? []}
                invalid={!!errors.forms}
                onChange={(p) => {
                  setPages((s) => ({ ...s, [f.id]: p }));
                  clear("forms");
                }}
              />
            ))}
          </div>
        </FormSection>
      )}

      <div className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Once submitted, the offload is locked and dispatch is alerted right
          away. Only an admin can correct it, and every change is logged.
        </p>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="submit"
          disabled={pending}
          className="h-14 px-8 text-base font-semibold"
        >
          {pending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            "Submit offload"
          )}
        </Button>
      </div>
    </form>
  );
}
