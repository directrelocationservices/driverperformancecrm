// File: src/components/admin/damage-note-form.tsx
// (NEW file)

"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormError, TEXTAREA_CLASS } from "@/components/driver/form-bits";
import { PhotoPicker } from "@/components/driver/photo-picker";
import { addDamageNoteAction } from "@/app/(admin)/admin/actions";
import { OfflineUploadError, prepareEvidence } from "@/lib/evidence/upload";

/** Admin adds a note (and photos) to an existing damage incident */
export function DamageNoteForm({
  damageId,
  jobId,
}: {
  damageId: string;
  jobId: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const key = useRef(`note-${crypto.randomUUID()}`);

  const reset = () => {
    setNote("");
    setPhotos([]);
    setError(undefined);
    key.current = `note-${crypto.randomUUID()}`;
    setOpen(false);
  };

  const save = () => {
    setError(undefined);
    if (!note.trim()) {
      setError("Write a note.");
      return;
    }
    startTransition(async () => {
      try {
        const ready = await prepareEvidence(
          "damage",
          { jobId, damageId, note, photos },
          key.current,
        );
        const res = await addDamageNoteAction(ready);
        if (res?.fieldErrors)
          setError(Object.values(res.fieldErrors).find(Boolean));
        else if (res?.error) setError(res.error);
        else {
          toast.success("Note added.");
          reset();
        }
      } catch (err) {
        setError(
          err instanceof OfflineUploadError
            ? "No connection. Please try again when you're online."
            : "Photos couldn't be uploaded. Please try again.",
        );
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border bg-white px-3 text-sm font-semibold text-foreground transition hover:border-foreground/30"
      >
        <MessageSquarePlus className="h-4 w-4" />{" "}
        <span className="hidden sm:inline">Add note</span>
      </button>
    );
  }

  return (
    <div className="mt-4 w-full basis-full space-y-3 rounded-xl border-2 border-primary/30 bg-primary/[0.03] p-4">
      <p className="font-semibold">Add a note</p>
      <FormError message={error} />
      <textarea
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setError(undefined);
        }}
        placeholder="e.g. Customer sent more photos. Repair quote is $450."
        className={TEXTAREA_CLASS}
      />
      <PhotoPicker value={photos} onChange={setPhotos} />
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
          onClick={save}
          disabled={pending}
          className="h-11 px-6 font-semibold"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save note"}
        </Button>
      </div>
    </div>
  );
}
