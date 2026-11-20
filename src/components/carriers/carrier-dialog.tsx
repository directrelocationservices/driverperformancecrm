// File: src/components/carriers/carrier-dialog.tsx
// (NEW file)

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Paperclip, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/shared/modal";
import {
  Field,
  FormError,
  Segmented,
  TEXTAREA_CLASS,
} from "@/components/driver/form-bits";
import { saveCarrierAction } from "@/app/(admin)/admin/carrier-actions";
import { uploadInsuranceFile } from "@/lib/carriers-upload";
import type { Carrier } from "@/types";

const empty = {
  companyName: "",
  usdot: "",
  mcNumber: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  insurancePath: null as string | null,
  insuranceFileName: null as string | null,
  insuranceExpires: "",
  notes: "",
  active: true,
};

const fromCarrier = (c?: Carrier) =>
  c
    ? {
        companyName: c.companyName,
        usdot: c.usdot ?? "",
        mcNumber: c.mcNumber ?? "",
        contactName: c.contactName ?? "",
        contactPhone: c.contactPhone ?? "",
        contactEmail: c.contactEmail ?? "",
        insurancePath: c.insurancePath,
        insuranceFileName: c.insuranceFileName,
        insuranceExpires: c.insuranceExpires ?? "",
        notes: c.notes ?? "",
        active: c.active,
      }
    : empty;

export function CarrierDialogButton({ carrier }: { carrier?: Carrier }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [v, setV] = useState(fromCarrier(carrier));

  const set = (k: keyof typeof v, value: string | boolean | null) => {
    setV((s) => ({ ...s, [k]: value }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }));
  };

  const close = () => {
    setOpen(false);
    setErrors({});
    setFormError(undefined);
    setV(fromCarrier(carrier));
  };

  const pickFile = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const up = await uploadInsuranceFile(file);
      setV((s) => ({
        ...s,
        insurancePath: up.path,
        insuranceFileName: up.name,
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(undefined);
    startTransition(async () => {
      const res = await saveCarrierAction({
        id: carrier?.id,
        ...v,
        insuranceExpires: v.insuranceExpires || null,
      });
      if (res.fieldErrors) {
        setErrors(res.fieldErrors);
        setFormError("Please fix the highlighted fields.");
      } else if (res.error) setFormError(res.error);
      else {
        toast.success(carrier ? "Carrier updated" : `${v.companyName} added`);
        setOpen(false);
        if (carrier) router.refresh();
        else {
          setV(empty);
          router.push(`/admin/carriers/${res.id}`);
        }
      }
    });
  };

  const input = (
    k: keyof typeof v,
    label: string,
    opts: { optional?: boolean; placeholder?: string; type?: string } = {},
  ) => (
    <Field
      label={label}
      htmlFor={`c-${k}`}
      optional={opts.optional}
      error={errors[k]}
    >
      <Input
        id={`c-${k}`}
        type={opts.type ?? "text"}
        value={String(v[k] ?? "")}
        onChange={(e) => set(k, e.target.value)}
        placeholder={opts.placeholder}
        aria-invalid={!!errors[k]}
        className="h-12 bg-white text-base"
      />
    </Field>
  );

  return (
    <>
      {carrier ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-11 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold hover:border-foreground/30"
        >
          <Pencil className="h-4 w-4" /> Edit carrier
        </button>
      ) : (
        <Button
          type="button"
          onClick={() => setOpen(true)}
          className="h-11 px-5 font-semibold"
        >
          <Plus className="mr-1 h-4 w-4" /> Add carrier
        </Button>
      )}

      <Modal
        open={open}
        onClose={close}
        title={carrier ? `Edit ${carrier.companyName}` : "Add carrier"}
      >
        <form onSubmit={save} className="space-y-5" noValidate>
          <FormError message={formError} />
          {input("companyName", "Company name", {
            placeholder: "e.g. Blue Line Movers LLC",
          })}
          <div className="grid gap-5 sm:grid-cols-2">
            {input("usdot", "USDOT number", {
              optional: true,
              placeholder: "e.g. 1234567",
            })}
            {input("mcNumber", "MC number", {
              optional: true,
              placeholder: "e.g. MC-123456",
            })}
          </div>
          {input("contactName", "Contact name", { optional: true })}
          <div className="grid gap-5 sm:grid-cols-2">
            {input("contactPhone", "Contact phone", {
              optional: true,
              type: "tel",
            })}
            {input("contactEmail", "Contact email", {
              optional: true,
              type: "email",
            })}
          </div>

          <div className="space-y-5 rounded-xl border bg-muted/30 p-4">
            <p className="font-semibold">Insurance certificate</p>
            {v.insurancePath ? (
              <div className="flex items-center gap-3 rounded-xl border bg-white p-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-50 text-primary">
                  <FileText className="h-5 w-5" />
                </span>
                <p className="min-w-0 flex-1 truncate font-semibold">
                  {v.insuranceFileName ?? "Certificate"}
                </p>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => {
                    set("insurancePath", null);
                    set("insuranceFileName", null);
                  }}
                  aria-label="Remove file"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input bg-white text-[15px] font-semibold text-foreground/80 transition hover:border-primary/50 disabled:opacity-60"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Paperclip className="h-5 w-5" />
                )}
                {uploading ? "Uploading…" : "Upload certificate (PDF or photo)"}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            {input("insuranceExpires", "Insurance expires", {
              optional: !v.insurancePath,
              type: "date",
            })}
            <p className="text-sm text-muted-foreground">
              Admins get an email 30 days before this date.
            </p>
          </div>

          <Field label="Notes" htmlFor="c-notes" optional error={errors.notes}>
            <textarea
              id="c-notes"
              value={v.notes}
              onChange={(e) => set("notes", e.target.value)}
              className={TEXTAREA_CLASS}
            />
          </Field>
          <Field label="Status">
            <Segmented
              value={v.active ? "active" : "inactive"}
              onChange={(x) => set("active", x === "active")}
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={close}
              className="h-12 rounded-lg px-6 font-semibold text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <Button
              type="submit"
              disabled={pending || uploading}
              className="h-12 px-8 font-semibold"
            >
              {pending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : carrier ? (
                "Save changes"
              ) : (
                "Add carrier"
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
