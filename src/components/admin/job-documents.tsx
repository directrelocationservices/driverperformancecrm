// File: src/components/admin/job-documents.tsx
// (NEW file)

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, RotateCcw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/driver/form-bits";
import {
  addJobDocumentsAction,
  setJobDocumentDeletedAction,
} from "@/app/(admin)/admin/job-actions";
import { uploadJobDocument } from "@/lib/evidence/job-documents-upload";
import { formatDateTimeET } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { JobDocument, JobDocumentKind } from "@/types";

const KIND_LABELS: Record<JobDocumentKind, string> = {
  paperwork: "Signed paperwork",
  photo: "Photo",
  other: "Other",
};

/** Photos and signed paperwork uploaded to a job after the fact */
export function JobDocuments({
  jobId,
  documents,
  names,
}: {
  jobId: string;
  documents: JobDocument[];
  /** user id → name, for "Uploaded by" */
  names: Record<string, string>;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<JobDocumentKind>("paperwork");
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  // Removed files are listed only when "Show deleted" is on for the page
  const visible = documents;

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    try {
      const files = [];
      for (const f of Array.from(list).slice(0, 20)) {
        const up = await uploadJobDocument(jobId, f);
        files.push({ ...up, kind });
      }
      const res = await addJobDocumentsAction({ jobId, files });
      if (res.error) toast.error(res.error);
      else {
        toast.success(
          `${files.length} file${files.length > 1 ? "s" : ""} uploaded.`,
        );
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function toggleDeleted(d: JobDocument) {
    const del = !d.deletedAt;
    if (
      del &&
      !window.confirm(
        `Remove "${d.name}"? You can restore it with "Show deleted".`,
      )
    )
      return;
    startTransition(async () => {
      const res = await setJobDocumentDeletedAction(d.id, del);
      if (res.error) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label="File type"
          value={kind}
          onChange={(e) => setKind(e.target.value as JobDocumentKind)}
          className="h-10 w-auto"
        >
          {(Object.keys(KIND_LABELS) as JobDocumentKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </NativeSelect>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Upload files
        </Button>
        <span className="text-xs text-muted-foreground">
          Photos or PDFs, up to 15 MB each
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((d) => (
            <li
              key={d.id}
              className={cn(
                "flex gap-3 rounded-xl border bg-white p-3",
                d.deletedAt && "opacity-60",
              )}
            >
              <a
                href={d.url}
                target="_blank"
                rel="noreferrer"
                className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted"
              >
                {d.isPdf ? (
                  <FileText className="h-7 w-7 text-muted-foreground" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={d.url}
                    alt={d.name}
                    className="h-full w-full object-cover"
                  />
                )}
              </a>
              <div className="min-w-0 flex-1 text-sm">
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate font-semibold hover:underline"
                >
                  {d.name}
                </a>
                <p className="text-xs text-muted-foreground">
                  {KIND_LABELS[d.kind]}
                  {d.deletedAt && " · removed"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Uploaded by {names[d.uploadedBy ?? ""] ?? "office"} ·{" "}
                  {formatDateTimeET(d.createdAt)}
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => toggleDeleted(d)}
                title={d.deletedAt ? "Restore" : "Remove"}
                className="self-start rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {d.deletedAt ? (
                  <RotateCcw className="h-4 w-4" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
