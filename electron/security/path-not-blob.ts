/**
 * Path-not-blob IPC policy — prefer filesystem paths over large base64 blobs.
 */
// @ts-nocheck

import { z } from 'zod';

/** Hard caps for IPC string fields that look like file content / base64. */
export const IPC_MAX_BLOB_CHARS = 256_000;
export const IPC_MAX_PATH_CHARS = 4096;
export const IPC_WARN_BLOB_CHARS = 64_000;

export const PathPayload = z.string().min(1).max(IPC_MAX_PATH_CHARS);

export const PathOrSmallBlob = z
  .object({
    path: z.string().min(1).max(IPC_MAX_PATH_CHARS).optional(),
    blob: z.string().max(IPC_MAX_BLOB_CHARS).optional(),
    mimeType: z.string().max(128).optional(),
  })
  .refine((v) => Boolean(v.path) || Boolean(v.blob), {
    message: 'path oder blob erforderlich',
  })
  .refine((v) => !(v.blob && v.blob.length > IPC_MAX_BLOB_CHARS), {
    message: `blob überschreitet ${IPC_MAX_BLOB_CHARS} Zeichen — path verwenden`,
  });

export type PathOrSmallBlobValue = z.infer<typeof PathOrSmallBlob>;

export function assertPathNotBlobPolicy(value: PathOrSmallBlobValue): {
  ok: boolean;
  preferPath: boolean;
  reason?: string;
} {
  if (value.path && !value.blob) {
    return { ok: true, preferPath: true };
  }
  if (value.blob && value.blob.length > IPC_WARN_BLOB_CHARS) {
    return {
      ok: true,
      preferPath: true,
      reason: `Blob ${value.blob.length} Zeichen — besser path übergeben (Limit ${IPC_MAX_BLOB_CHARS})`,
    };
  }
  if (value.blob && value.blob.length > IPC_MAX_BLOB_CHARS) {
    return {
      ok: false,
      preferPath: true,
      reason: `Blob zu groß (${value.blob.length} > ${IPC_MAX_BLOB_CHARS})`,
    };
  }
  return { ok: true, preferPath: Boolean(value.path) };
}
