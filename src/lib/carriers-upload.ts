// File: src/lib/carriers-upload.ts
// (NEW file)

"use client";

import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { CARRIER_BUCKET } from "@/lib/carriers";

export type UploadedCarrierFile = { name: string; path: string };

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

/** Uploads an insurance certificate (PDF or photo) to private storage */
export async function uploadInsuranceFile(
  file: File,
): Promise<UploadedCarrierFile> {
  if (file.size > 15 * 1024 * 1024)
    throw new Error("File is too large (max 15 MB).");

  let blob: Blob = file;
  let ext = "pdf";
  if (file.type === "application/pdf") {
    blob = file;
  } else if (file.type.startsWith("image/")) {
    ({ blob, ext } = dataUrlToBlob(await compressImage(file)));
  } else {
    throw new Error("Upload a PDF or a photo.");
  }

  const path = `insurance/${crypto.randomUUID()}.${ext}`;
  const { error } = await createClient()
    .storage.from(CARRIER_BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: false });
  if (error)
    throw new Error("The file couldn't be uploaded. Please try again.");
  return { name: file.name.slice(0, 200), path };
}

async function put(path: string, blob: Blob) {
  const { error } = await createClient()
    .storage.from(CARRIER_BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: false });
  if (error && !/exists|duplicate/i.test(error.message))
    throw new Error("A file couldn't be uploaded. Please try again.");
  return path;
}

/** Claim photo from the photo picker (already compressed) */
export async function uploadClaimPhoto(claimId: string, dataUrl: string) {
  const { blob, ext } = dataUrlToBlob(dataUrl);
  return put(`claims/${claimId}/${crypto.randomUUID()}.${ext}`, blob);
}

/** Document or photo added to a claim's notes (PDF or image) */
export async function uploadClaimFile(
  claimId: string,
  file: File,
): Promise<UploadedCarrierFile> {
  if (file.size > 15 * 1024 * 1024)
    throw new Error("File is too large (max 15 MB).");
  let blob: Blob = file;
  let ext = "pdf";
  if (file.type.startsWith("image/")) {
    ({ blob, ext } = dataUrlToBlob(await compressImage(file)));
  } else if (file.type !== "application/pdf") {
    throw new Error("Upload a PDF or a photo.");
  }
  const path = await put(
    `claims/${claimId}/${crypto.randomUUID()}.${ext}`,
    blob,
  );
  return { name: file.name.slice(0, 200), path };
}
