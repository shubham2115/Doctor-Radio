import type { FileKind } from "@prisma/client";

export type Sniffed = { kind: FileKind; mime: string; ext: string };

const startsWith = (b: Buffer, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);

/**
 * Identify a file by its actual signature, never by extension or client-declared MIME type.
 * Returns null for anything that is not an accepted format.
 */
export function sniff(b: Buffer): Sniffed | null {
  if (b.length < 8) return null;
  if (startsWith(b, [0xff, 0xd8, 0xff])) return { kind: "IMAGE", mime: "image/jpeg", ext: "jpg" };
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { kind: "IMAGE", mime: "image/png", ext: "png" };
  if (startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { kind: "PDF", mime: "application/pdf", ext: "pdf" };
  if (b.length > 132 && b.toString("latin1", 128, 132) === "DICM") return { kind: "DICOM", mime: "application/dicom", ext: "dcm" };
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04])) return { kind: "ARCHIVE", mime: "application/zip", ext: "zip" };
  if (startsWith(b, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])) return { kind: "ARCHIVE", mime: "application/vnd.rar", ext: "rar" };
  return null;
}

export const LIMITS = {
  maxFileBytes: 150 * 1024 * 1024,
  maxTotalBytes: 400 * 1024 * 1024,
  maxFilesPerUpload: 40,
  maxFilesPerCase: 400,
  maxArchiveEntries: 400,
  maxArchiveUncompressedBytes: 600 * 1024 * 1024,
  maxCompressionRatio: 150,
};

/** Strip any path and control characters from a client-supplied filename (display only). */
export function safeName(name: string) {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "file";
}
