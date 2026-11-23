// File: src/components/admin/offload-admin.tsx
// (NEW file)

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FilePlus2,
  Loader2,
  Pencil,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Field,
  FormError,
  NativeSelect,
  TEXTAREA_CLASS,
} from "@/components/driver/form-bits";
import {
  addOffloadPagesAction,
  correctOffloadAction,
  setOffloadDeletedAction,
} from "@/app/(admin)/admin/offload-actions";
import { uploadJobDocument } from "@/lib/evidence/job-documents-upload";
import {
  OFFLOAD_DESTINATION_LABELS,
  type Offload,
  type OffloadDestination,
} from "@/types";

type Mode = "none" | "correct" | "pages" | "delete";

const btn =
  "flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 text-sm font-semibold text-foreground transition hover:border-foreground/30";

/** Admin tools on an offload: correct, add missing paperwork, delete / restore */
export function OffloadAdmin({
  offload: o,
  carriers,
}: {
  offload: Offload;
  carriers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("none");
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();

  const initial = {
    destination: o.destination as OffloadDestination,
    storageFacility: o.storageFacility ?? "",
    storageAddress: o.storageAddress ?? "",
    storageUnit: o.storageUnit ?? "",
    carrierId: o.carrierId ?? "",
    note: o.note ?? "",
    reason: "",
  };
  const [v, setV] = useState(initial);
  const set =
    (k: keyof typeof v) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      setV((s) => ({ ...s, [k]: e.target.value }));
      if (errors[k]) setErrors((er) => ({ ...er, [k]: "" }));
    };

  // Add pages
  const fileRef = useRef<HTMLInputElement>(null);
  const firstMissing = o.forms.find((f) => !f.files.length) ?? o.forms[0];
  const [formId, setFormId] = useState(firstMissing?.formId ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [pageReason, setPageReason] = useState("");
  const [delReason, setDelReason] = useState("");

  const close = () => {
    setMode("none");
    setErrors({});
    setFormError(undefined);
    setV(initial);
    setFiles([]);
    setPageReason("");
    setDelReason("");
  };

  const done = (msg: string) => {
    toast.success(msg);
    close();
    router.refresh();
  };

  const saveCorrection = () =>
    startTransition(async () => {
      setFormError(undefined);
      const res = await correctOffloadAction({ id: o.id, ...v });
      if (res.fieldErrors) setErrors(res.fieldErrors);
      else if (res.error) setFormError(res.error);
      else done("Offload corrected. The original is kept in the history.");
    });

  const savePages = () =>
    startTransition(async () => {
      setFormError(undefined);
      if (!files.length) return setFormError("Choose at least one page.");
      try {
        const pages = [];
        for (const f of files)
          pages.push((await uploadJobDocument(o.jobId, f, "offload")).path);
        const res = await addOffloadPagesAction({
          id: o.id,
          formId,
          pages,
          reason: pageReason,
        });
        if (res.fieldErrors) setFormError(Object.values(res.fieldErrors)[0]);
        else if (res.error) setFormError(res.error);
        else done("Paperwork added. The change is kept in the history.");
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Upload failed.");
      }
    });

  const toggleDeleted = (deleted: boolean) =>
    startTransition(async () => {
      setFormError(undefined);
      const res = await setOffloadDeletedAction(o.id, deleted, delReason);
      if (res.fieldErrors) setFormError(Object.values(res.fieldErrors)[0]);
      else if (res.error) setFormError(res.error);
      else done(deleted ? "Offload deleted." : "Offload restored.");
    });

  if (o.deletedAt) {
    return (
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          className={btn}
          disabled={pending}
          onClick={() => toggleDeleted(false)}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          Restore
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {mode === "none" && (
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className={btn}
            onClick={() => setMode("correct")}
          >
            <Pencil className="h-4 w-4" /> Correct
          </button>
          {o.forms.length > 0 && (
            <button
              type="button"
              className={btn}
              onClick={() => setMode("pages")}
            >
              <FilePlus2 className="h-4 w-4" /> Add paperwork
            </button>
          )}
          <button
            type="button"
            className={btn}
            onClick={() => setMode("delete")}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      )}

      {mode !== "none" && (
        <div className="space-y-4 rounded-xl border-2 border-primary/30 bg-primary/[0.03] p-4">
          <FormError message={formError} />

          {mode === "correct" && (
            <>
              <div>
                <p className="font-semibold">Correct this offload</p>
                <p className="text-sm text-muted-foreground">
                  Photos, GPS and times can&apos;t be changed. The original
                  values are kept in the history.
                </p>
              </div>
              <Field label="Offloaded at" error={errors.destination}>
                <NativeSelect
                  value={v.destination}
                  onChange={set("destination")}
                >
                  {(
                    Object.keys(
                      OFFLOAD_DESTINATION_LABELS,
                    ) as OffloadDestination[]
                  ).map((k) => (
                    <option key={k} value={k}>
                      {OFFLOAD_DESTINATION_LABELS[k]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              {v.destination === "storage" && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Facility name" error={errors.storageFacility}>
                    <Input
                      value={v.storageFacility}
                      onChange={set("storageFacility")}
                      className="h-11 bg-white"
                    />
                  </Field>
                  <Field label="Facility address" error={errors.storageAddress}>
                    <Input
                      value={v.storageAddress}
                      onChange={set("storageAddress")}
                      className="h-11 bg-white"
                    />
                  </Field>
                  <Field label="Unit number" error={errors.storageUnit}>
                    <Input
                      value={v.storageUnit}
                      onChange={set("storageUnit")}
                      className="h-11 bg-white"
                    />
                  </Field>
                </div>
              )}
              {v.destination === "carrier" && (
                <Field label="Partner carrier" error={errors.carrierId}>
                  <NativeSelect value={v.carrierId} onChange={set("carrierId")}>
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
                label="Note"
                error={errors.note}
                optional={v.destination !== "other"}
              >
                <textarea
                  value={v.note}
                  onChange={set("note")}
                  className={TEXTAREA_CLASS}
                />
              </Field>
              <Field label="Reason for correction" error={errors.reason}>
                <Input
                  value={v.reason}
                  onChange={set("reason")}
                  placeholder="e.g. Driver chose the wrong storage unit"
                  className="h-11 bg-white"
                />
              </Field>
            </>
          )}

          {mode === "pages" && (
            <>
              <div>
                <p className="font-semibold">Add paperwork</p>
                <p className="text-sm text-muted-foreground">
                  For pages the driver sent later. Saved with your name and a
                  reason.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Form">
                  <NativeSelect
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                  >
                    {o.forms.map((f) => (
                      <option key={f.formId} value={f.formId}>
                        {f.name}
                        {f.files.length
                          ? ` (${f.files.length} pages)`
                          : " (missing)"}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Pages" hint="Photos or PDFs">
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) =>
                      setFiles(Array.from(e.target.files ?? []).slice(0, 10))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-white text-sm font-semibold"
                  >
                    <Upload className="h-4 w-4" />
                    {files.length
                      ? `${files.length} file${files.length > 1 ? "s" : ""} chosen`
                      : "Choose files"}
                  </button>
                </Field>
              </div>
              <Field label="Reason">
                <Input
                  value={pageReason}
                  onChange={(e) => setPageReason(e.target.value)}
                  placeholder="e.g. Driver emailed the signed BOL"
                  className="h-11 bg-white"
                />
              </Field>
            </>
          )}

          {mode === "delete" && (
            <Field label="Reason for deleting">
              <Input
                value={delReason}
                onChange={(e) => setDelReason(e.target.value)}
                placeholder="e.g. Submitted on the wrong job"
                className="h-11 bg-white"
              />
            </Field>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={close}
              className="h-11 rounded-lg px-5 text-sm font-semibold text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <Button
              type="button"
              disabled={pending}
              variant={mode === "delete" ? "destructive" : "default"}
              onClick={
                mode === "correct"
                  ? saveCorrection
                  : mode === "pages"
                    ? savePages
                    : () => toggleDeleted(true)
              }
              className="h-11 px-6 font-semibold"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "correct" ? (
                "Save correction"
              ) : mode === "pages" ? (
                "Add pages"
              ) : (
                "Delete offload"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
