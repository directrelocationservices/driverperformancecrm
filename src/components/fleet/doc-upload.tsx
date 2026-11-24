// File: src/components/fleet/doc-upload.tsx
// (NEW file)

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Paperclip, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, FormError, NativeSelect } from "@/components/driver/form-bits";
import { PhotoSlot } from "./photo-slot";
import {
  OfflineUploadError,
  UploadRejectedError,
  uploadFleetDocument,
  uploadFleetPhoto,
  type UploadedReport,
} from "@/lib/evidence/upload";
import { uploadDocumentAction } from "@/app/(admin)/admin/readiness-actions";
import { createDriverDocumentAction } from "@/app/(driver)/driver/fleet-actions";
import { DOC_TYPE_LABELS, EXPIRING_DOC_TYPES, type DocType } from "@/types";

const isDriverDoc = (t: DocType) => t === "medical_card" || t === "license";

/**
 * Upload a document. Truck documents: one PDF or photo (admins).
 * Driver documents: a photo of the front and the back, plus the expiry date.
 */
export function DocUpload({
  owner,
  ownerId,
  types,
  as,
  defaultType,
  buttonLabel = "Upload document",
}: {
  owner: "truck" | "driver";
  ownerId: string;
  types: DocType[];
  /** Which portal is uploading */
  as: "admin" | "driver";
  defaultType?: DocType;
  buttonLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();

  const [docType, setDocType] = useState<DocType>(defaultType ?? types[0]);
  const [title, setTitle] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [file, setFile] = useState<UploadedReport | null>(null);
  const [front, setFront] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setOpen(false);
    setErrors({});
    setFormError(undefined);
    setTitle("");
    setExpiresOn("");
    setFile(null);
    setFront(null);
    setBack(null);
  };

  const pick = async (f?: File) => {
    if (!f) return;
    if (f.size > 15 * 1024 * 1024)
      return toast.error("File is too large (max 15 MB).");
    setBusy(true);
    try {
      setFile(await uploadFleetDocument(f));
      setErrors((e) => ({ ...e, files: "" }));
    } catch (err) {
      if (err instanceof OfflineUploadError)
        toast.error("No signal. Try again when you're online.");
      else if (err instanceof UploadRejectedError) toast.error(err.message);
      else toast.error("Couldn't upload that file.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = () =>
    startTransition(async () => {
      setFormError(undefined);
      setErrors({});
      try {
        let files: { path: string; name: string }[] = [];
        if (isDriverDoc(docType)) {
          if (!front || !back) {
            setErrors({ files: "Add a photo of the front and the back" });
            return;
          }
          const id = crypto.randomUUID();
          files = [
            {
              path: await uploadFleetPhoto("docs", `${id}-front`, front),
              name: "Front",
            },
            {
              path: await uploadFleetPhoto("docs", `${id}-back`, back),
              name: "Back",
            },
          ];
        } else if (file) {
          files = [{ path: file.path, name: file.name }];
        }
        const input = {
          truckId: owner === "truck" ? ownerId : undefined,
          driverId: owner === "driver" ? ownerId : undefined,
          docType,
          title: docType === "other" ? title.trim() || undefined : undefined,
          files,
          expiresOn: EXPIRING_DOC_TYPES.includes(docType)
            ? expiresOn || undefined
            : undefined,
        };
        const res =
          as === "admin"
            ? await uploadDocumentAction(input)
            : await createDriverDocumentAction(input);
        if (res?.fieldErrors) setErrors(res.fieldErrors);
        else if (res?.error) setFormError(res.error);
        else {
          toast.success(`${DOC_TYPE_LABELS[docType]} saved`);
          reset();
          router.refresh();
        }
      } catch (err) {
        if (err instanceof OfflineUploadError)
          setFormError("No signal. Try again when you're online.");
        else if (err instanceof UploadRejectedError) setFormError(err.message);
        else setFormError("Couldn't save. Please try again.");
      }
    });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90"
      >
        <Upload className="h-4 w-4" /> {buttonLabel}
      </button>
    );
  }

  const needsExpiry = EXPIRING_DOC_TYPES.includes(docType);

  return (
    <div className="w-full space-y-4 rounded-xl border-2 border-primary/30 bg-primary/[0.03] p-4">
      <FormError message={formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        {types.length > 1 && (
          <Field label="Document">
            <NativeSelect
              value={docType}
              onChange={(e) => {
                setDocType(e.target.value as DocType);
                setErrors({});
              }}
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {DOC_TYPE_LABELS[t]}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
        {docType === "other" && (
          <Field label="Document name" error={errors.title}>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. IFTA license"
              className="h-12 bg-white text-base"
            />
          </Field>
        )}
        {needsExpiry && (
          <Field label="Expiry date" htmlFor="doc-exp" error={errors.expiresOn}>
            <Input
              id="doc-exp"
              type="date"
              value={expiresOn}
              onChange={(e) => {
                setExpiresOn(e.target.value);
                setErrors((x) => ({ ...x, expiresOn: "" }));
              }}
              aria-invalid={!!errors.expiresOn}
              className="h-12 bg-white text-base"
            />
          </Field>
        )}
      </div>

      {isDriverDoc(docType) ? (
        <div>
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <PhotoSlot
              label="Front"
              value={front}
              onChange={setFront}
              invalid={!!errors.files && !front}
            />
            <PhotoSlot
              label="Back"
              value={back}
              onChange={setBack}
              invalid={!!errors.files && !back}
            />
          </div>
          {errors.files && (
            <p className="mt-1.5 text-sm font-medium text-destructive">
              {errors.files}
            </p>
          )}
        </div>
      ) : (
        <Field
          label="File"
          hint="PDF or photo, up to 15 MB"
          error={errors.files}
        >
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0])}
          />
          {file ? (
            <div className="flex items-center gap-3 rounded-xl border bg-white p-3">
              <FileText className="h-5 w-5 shrink-0 text-primary" />
              <p className="min-w-0 flex-1 truncate text-sm font-medium">
                {file.name}
              </p>
              <button
                type="button"
                onClick={() => setFile(null)}
                aria-label="Remove file"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-white text-sm font-semibold"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
              {busy ? "Uploading…" : "Choose file"}
            </button>
          )}
        </Field>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={reset}
          className="h-11 rounded-lg px-5 text-sm font-semibold text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
        <Button
          type="button"
          disabled={pending || busy}
          onClick={save}
          className="h-11 px-6 font-semibold"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Save document"
          )}
        </Button>
      </div>
    </div>
  );
}
