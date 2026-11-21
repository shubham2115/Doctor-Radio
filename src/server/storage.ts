import fs from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Private object storage. Files are never served statically: every read goes through /api/files/*,
 * which enforces a short-lived signature plus session/access checks.
 *
 *  - S3-compatible driver (AWS S3, Cloudflare R2, Supabase Storage, MinIO…) when S3_BUCKET is set.
 *    Required for serverless hosts such as Vercel, whose filesystem is read-only/ephemeral.
 *  - Local-disk driver for development (STORAGE_DIR, default ./.storage).
 */
export interface ObjectStorage {
  put(key: string, data: Buffer, contentType?: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export class StorageNotConfigured extends Error {}

// ───────── S3-compatible ─────────

function s3Driver(): ObjectStorage {
  const bucket = process.env.S3_BUCKET!;
  const client = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true", // MinIO / some providers
    credentials: process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY
      ? { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY }
      : undefined,
  });
  // Server-side encryption at rest: AWS S3 supports AES256; set S3_SSE=false for providers that reject the header.
  const sse = process.env.S3_SSE === "false" ? undefined : ("AES256" as const);

  return {
    async put(key, data, contentType) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: data, ContentType: contentType ?? "application/octet-stream", ServerSideEncryption: sse }));
    },
    async get(key) {
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!res.Body) throw new Error("Empty object");
      return Buffer.from(await res.Body.transformToByteArray());
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

// ───────── Local disk (development) ─────────

function localDriver(): ObjectStorage {
  const ROOT = path.resolve(process.env.STORAGE_DIR ?? ".storage");
  const resolveKey = (key: string) => {
    // Keys are server-generated, but never trust that: refuse anything escaping ROOT.
    const full = path.resolve(ROOT, key);
    if (!full.startsWith(ROOT + path.sep)) throw new Error("Invalid storage key");
    return full;
  };
  return {
    async put(key, data) {
      const full = resolveKey(key);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, data, { mode: 0o600 });
    },
    get: (key) => fs.readFile(resolveKey(key)),
    async delete(key) {
      await fs.rm(resolveKey(key), { force: true });
    },
  };
}

function create(): ObjectStorage {
  if (process.env.S3_BUCKET) return s3Driver();
  // Serverless production has no writable disk: fail loudly instead of with a cryptic ENOENT.
  if (process.env.VERCEL || (process.env.NODE_ENV === "production" && !process.env.STORAGE_DIR)) {
    throw new StorageNotConfigured("File storage is not configured. Set S3_BUCKET (and S3_* credentials) to enable uploads.");
  }
  return localDriver();
}

let instance: ObjectStorage | undefined;
const get = () => (instance ??= create());

export const storage: ObjectStorage = {
  put: (k, d, t) => get().put(k, d, t),
  get: (k) => get().get(k),
  delete: (k) => get().delete(k),
};

export const storageConfigured = () => {
  try { get(); return true; } catch { return false; }
};
