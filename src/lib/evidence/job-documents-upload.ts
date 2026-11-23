// File: src/lib/evidence/job-documents-upload.ts
// (REPLACE the whole file)

"use client";

import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { EVIDENCE_BUCKET, evidencePath } from "./paths";

function dataUrlToBlob(dataUrl: string) {
  const [head, body] = dataUrl.split(",", 2);
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? "image/jpeg";
  const bytes = atob(body);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  const png = mime === "image/png";
  return {
    blob: new Blob([arr], { type: png ? "image/png" : "image/jpeg" }),
    ext: png ? "png" : "jpg",
  };
}

/** Uploads a photo or PDF to the job's private folder: <job>/<kind>/<file> */
export async function uploadJobDocument(
  jobId: string,
  file: File,
  /** "offload" for paperwork added to an offload */
  kind: "document" | "offload" = "document",
): Promise<{ path: string; name: string }> {
  if (file.size > 15 * 1024 * 1024)
    throw new Error(`${file.name} is too large (max 15 MB).`);
  let blob: Blob = file;
  let ext = "pdf";
  if (file.type.startsWith("image/")) {
    ({ blob, ext } = dataUrlToBlob(await compressImage(file)));
  } else if (file.type !== "application/pdf") {
    throw new Error(`${file.name}: upload a PDF or a photo.`);
  }
  const path = evidencePath(jobId, kind, `${crypto.randomUUID()}.${ext}`);
  const { error } = await createClient()
    .storage.from(EVIDENCE_BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: false });
  if (error)
    throw new Error(`${file.name} couldn't be uploaded. Please try again.`);
  return { path, name: file.name.slice(0, 200) };
}
