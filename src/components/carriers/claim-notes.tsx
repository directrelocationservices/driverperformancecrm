// File: src/components/carriers/claim-notes.tsx
// (NEW file)

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Image as ImageIcon,
  Loader2,
  Lock,
  MessageSquare,
  Paperclip,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormError, TEXTAREA_CLASS } from "@/components/driver/form-bits";
import { Pill } from "@/components/shared/pill";
import { addClaimNoteAction } from "@/app/(admin)/admin/carrier-actions";
import { addCarrierNoteAction } from "@/app/(carrier)/carrier/actions";
import {
  uploadClaimFile,
  type UploadedCarrierFile,
} from "@/lib/carriers-upload";
import { formatDateTimeET } from "@/lib/format";
import type { CarrierClaimNote } from "@/types";

/** Comments and documents on a claim. Admins can also write internal notes. */
export function ClaimNotes({
  claimId,
  notes,
  names,
  mode,
  otherName = "Unknown",
}: {
  claimId: string;
  notes: CarrierClaimNote[];
  /** user id → name */
  names: Record<string, string>;
  mode: "admin" | "carrier";
  /** Shown when the writer's name isn't in `names` */
  otherName?: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<UploadedCarrierFile[]>([]);
  const [internal, setInternal] = useState(false);
  const [error, setError] = useState<string>();

  const pick = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    try {
      const added: UploadedCarrierFile[] = [];
      for (const f of Array.from(list).slice(0, 5 - files.length))
        added.push(await uploadClaimFile(claimId, f));
      setFiles((s) => [...s, ...added]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = () => {
    setError(undefined);
    if (!note.trim()) return setError("Write a comment.");
    startTransition(async () => {
      const input = {
        claimId,
        note,
        files,
        internal: mode === "admin" && internal,
      };
      const res =
        mode === "admin"
          ? await addClaimNoteAction(input)
          : await addCarrierNoteAction(input);
      if (res.error) setError(res.error);
      else {
        setNote("");
        setFiles([]);
        setInternal(false);
        toast.success("Comment added.");
        router.refresh();
      }
    });
  };

  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex items-center gap-2.5 border-b px-4 py-3.5 sm:px-5">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Comments & documents</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">
          {notes.length}
        </span>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {notes.length === 0 && (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        )}
        {notes.map((n) => (
          <div
            key={n.id}
            className={
              n.internal
                ? "rounded-xl border border-dashed bg-amber-50/50 p-3"
                : "rounded-xl border p-3"
            }
          >
            <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
              {names[n.createdBy ?? ""] ?? otherName}
              <span className="font-normal text-muted-foreground">
                · {formatDateTimeET(n.createdAt)}
              </span>
              {n.internal && (
                <Pill tone="warning" className="ml-1">
                  <Lock className="h-3 w-3" /> Internal
                </Pill>
              )}
            </p>
            <p className="mt-1 whitespace-pre-line text-[15px]">{n.note}</p>
            {n.files.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {n.files.map((f, i) => (
                  <a
                    key={i}
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex max-w-full items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 text-sm font-medium hover:border-primary/40"
                  >
                    {f.isPdf ? (
                      <FileText className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <ImageIcon className="h-4 w-4 shrink-0 text-primary" />
                    )}
                    <span className="truncate">{f.name}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="space-y-3 border-t pt-4">
          <FormError message={error} />
          <textarea
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setError(undefined);
            }}
            placeholder={
              mode === "admin"
                ? "Write a comment for the carrier, or an internal note"
                : "Write a comment for Direct Relocation Services"
            }
            className={TEXTAREA_CLASS}
          />
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <span
                  key={f.path}
                  className="flex max-w-full items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 text-sm"
                >
                  <Paperclip className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    aria-label="Remove file"
                    onClick={() => setFiles((s) => s.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || files.length >= 5}
                className="flex h-10 items-center gap-1.5 rounded-lg border bg-white px-3 text-sm font-semibold hover:border-foreground/30 disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
                Attach PDF or photo
              </button>
              {mode === "admin" && (
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={internal}
                    onChange={(e) => setInternal(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  Internal (carrier can&apos;t see it)
                </label>
              )}
            </div>
            <Button
              type="button"
              onClick={save}
              disabled={pending || uploading}
              className="h-11 px-6 font-semibold"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Add comment"
              )}
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => pick(e.target.files)}
          />
        </div>
      </div>
    </section>
  );
}
