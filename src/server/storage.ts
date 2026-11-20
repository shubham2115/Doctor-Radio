import fs from "node:fs/promises";
import path from "node:path";

/**
 * Private object storage. The default driver writes to a directory that is never served statically;
 * every read goes through /api/files/* which enforces session + access + signed-URL checks.
 * An S3-compatible driver (MinIO/S3 with SSE) implements the same interface for production.
 */
export interface ObjectStorage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

const ROOT = path.resolve(process.env.STORAGE_DIR ?? ".storage");

function resolveKey(key: string) {
  // Keys are server-generated, but never trust that: refuse anything escaping ROOT.
  const full = path.resolve(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Invalid storage key");
  return full;
}

const local: ObjectStorage = {
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

export const storage: ObjectStorage = local;
