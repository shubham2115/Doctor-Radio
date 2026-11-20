import sharp from "sharp";
import type { FileKind } from "@prisma/client";
import { extractRar, extractZip, ArchiveError } from "./archive";
import { deidentifyDicom, type DeidFinding } from "./dicom";
import { safeName, sniff, LIMITS } from "./sniff";

export type Processed = {
  kind: Exclude<FileKind, "ARCHIVE">;
  mime: string;
  ext: string;
  name: string;
  data: Buffer;
  thumb?: Buffer;
  findings: DeidFinding[];
  burnedInSuspected: boolean;
  dicomMeta?: Record<string, string | number | null>;
  frames?: number;
  dicomSupported?: boolean;
};

export type UploadOutcome = { processed: Processed[]; warnings: string[] };

async function processOne(name: string, data: Buffer, warnings: string[]): Promise<Processed | null> {
  const sig = sniff(data);
  if (!sig || sig.kind === "ARCHIVE") {
    warnings.push(`${name}: unsupported or unrecognised file type — skipped`);
    return null;
  }
  const display = safeName(name);

  try {
    if (sig.kind === "IMAGE") {
      // Re-encoding drops EXIF/GPS/XMP metadata and neutralises polyglot payloads.
      const base = sharp(data, { limitInputPixels: 120_000_000 }).rotate();
      const clean = await (sig.ext === "png" ? base.clone().png() : base.clone().jpeg({ quality: 92 })).toBuffer();
      const thumb = await sharp(clean).resize({ width: 640, height: 400, fit: "cover" }).jpeg({ quality: 78 }).toBuffer();
      return {
        kind: "IMAGE", mime: sig.mime, ext: sig.ext, name: display, data: clean, thumb,
        findings: [{ tag: "exif", name: "Embedded image metadata (EXIF/GPS/XMP)", action: "removed" }],
        burnedInSuspected: true, // pixels can always contain text; the uploader must attest
      };
    }
    if (sig.kind === "PDF") {
      return {
        kind: "PDF", mime: sig.mime, ext: sig.ext, name: display, data,
        findings: [{ tag: "pdf", name: "PDF text and metadata cannot be scrubbed automatically — review manually", action: "flagged" }],
        burnedInSuspected: true,
      };
    }
    const d = deidentifyDicom(data);
    if (!d.supported) warnings.push(`${display}: compressed DICOM transfer syntax — stored, but the in-browser viewer cannot render it`);
    return {
      kind: "DICOM", mime: sig.mime, ext: sig.ext, name: display, data: d.data, findings: d.findings,
      burnedInSuspected: d.burnedInSuspected, dicomMeta: d.meta, frames: Math.max(1, Number(d.meta.frames) || 1), dicomSupported: d.supported,
    };
  } catch {
    warnings.push(`${display}: could not be processed (corrupted ${sig.kind.toLowerCase()}) — skipped`);
    return null;
  }
}

/** Validate + sanitise one uploaded file. Archives are expanded; their contents go through the same path. */
export async function processUpload(name: string, data: Buffer): Promise<UploadOutcome> {
  const warnings: string[] = [];
  const sig = sniff(data);
  if (!sig) return { processed: [], warnings: [`${safeName(name)}: unsupported or unrecognised file type — skipped`] };

  if (sig.kind !== "ARCHIVE") {
    const p = await processOne(name, data, warnings);
    return { processed: p ? [p] : [], warnings };
  }

  try {
    const { entries, skipped } = sig.ext === "zip" ? await extractZip(data) : await extractRar(data);
    if (skipped) warnings.push(`${safeName(name)}: ${skipped} encrypted or link entries were skipped`);
    const processed: Processed[] = [];
    for (const e of entries) {
      if (processed.length >= LIMITS.maxFilesPerCase) {
        warnings.push(`${safeName(name)}: file limit reached — remaining entries ignored`);
        break;
      }
      const inner = sniff(e.data);
      if (!inner || inner.kind === "ARCHIVE") {
        // Nested archives are rejected (zip-bomb defence); other junk (thumbs.db, txt) is ignored.
        if (inner?.kind === "ARCHIVE") warnings.push(`${safeName(e.name)}: nested archives are not allowed`);
        continue;
      }
      const p = await processOne(`${safeName(name)} › ${e.name.split(/[\\/]/).pop()}`, e.data, warnings);
      if (p) processed.push(p);
    }
    if (!processed.length) warnings.push(`${safeName(name)}: no supported images, PDFs or DICOM files found inside`);
    return { processed, warnings };
  } catch (e) {
    return { processed: [], warnings: [`${safeName(name)}: ${e instanceof ArchiveError ? e.message : "archive could not be read"}`] };
  }
}
