import yauzl from "yauzl";
import { createExtractorFromData } from "node-unrar-js";
import { LIMITS } from "./sniff";

export type ExtractedEntry = { name: string; data: Buffer };
export type ExtractResult = { entries: ExtractedEntry[]; skipped: number };

export class ArchiveError extends Error {}

/** yauzl itself refuses `../` and absolute names; surface that as a security rejection, not "corrupt". */
const zipError = (e?: Error | null) =>
  new ArchiveError(e && /relative path|absolute path/i.test(e.message) ? "Archive contains unsafe file paths" : "The ZIP archive is corrupted or unsupported");

/** Names are only kept for display. Entries are never written to disk by name, so traversal is moot,
 *  but we still reject suspicious paths outright so that nothing odd reaches the UI or logs. */
function suspicious(name: string) {
  return name.includes("\0") || name.startsWith("/") || /^[a-zA-Z]:/.test(name) || name.split(/[\\/]/).includes("..");
}

const ratioOk = (compressed: number, uncompressed: number) =>
  uncompressed < 1024 * 1024 || uncompressed / Math.max(compressed, 1) <= LIMITS.maxCompressionRatio;

export function extractZip(buf: Buffer): Promise<ExtractResult> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buf, { lazyEntries: true, validateEntrySizes: true, strictFileNames: false }, (err, zip) => {
      if (err || !zip) return reject(zipError(err));
      if (zip.entryCount > LIMITS.maxArchiveEntries) {
        zip.close();
        return reject(new ArchiveError(`Archive has too many files (limit ${LIMITS.maxArchiveEntries})`));
      }
      const entries: ExtractedEntry[] = [];
      let total = 0;
      let skipped = 0;
      const fail = (m: string) => {
        zip.close();
        reject(new ArchiveError(m));
      };

      zip.on("error", (e) => { zip.close(); reject(zipError(e)); });
      zip.on("end", () => resolve({ entries, skipped }));
      zip.on("entry", (entry: yauzl.Entry) => {
        const name = entry.fileName;
        if (/\/$/.test(name)) return zip.readEntry();
        if (suspicious(name)) return fail("Archive contains unsafe file paths");
        // Encrypted entries and symlinks cannot be inspected safely.
        const unixMode = (entry.externalFileAttributes >>> 16) & 0xffff;
        if (entry.isEncrypted() || (unixMode & 0o170000) === 0o120000) {
          skipped++;
          return zip.readEntry();
        }
        if (entry.uncompressedSize > LIMITS.maxFileBytes || !ratioOk(entry.compressedSize, entry.uncompressedSize)) {
          return fail("Archive rejected: file size or compression ratio exceeds safe limits");
        }
        total += entry.uncompressedSize;
        if (total > LIMITS.maxArchiveUncompressedBytes) return fail("Archive rejected: uncompressed size exceeds limit");

        zip.openReadStream(entry, (e, stream) => {
          if (e || !stream) return fail("The ZIP archive is corrupted");
          const chunks: Buffer[] = [];
          let got = 0;
          stream.on("data", (c: Buffer) => {
            got += c.length;
            // validateEntrySizes guards header lies, but enforce the cap on real bytes too.
            if (got > entry.uncompressedSize) {
              stream.destroy();
              fail("Archive rejected: entry larger than declared (possible decompression bomb)");
            } else chunks.push(c);
          });
          stream.on("error", () => fail("The ZIP archive is corrupted"));
          stream.on("end", () => {
            entries.push({ name, data: Buffer.concat(chunks) });
            zip.readEntry();
          });
        });
      });
      zip.readEntry();
    });
  });
}

export async function extractRar(buf: Buffer): Promise<ExtractResult> {
  try {
    const data = Uint8Array.from(buf).buffer;
    const extractor = await createExtractorFromData({ data });
    const headers = [...extractor.getFileList().fileHeaders].filter((h) => !h.flags.directory);
    if (headers.length > LIMITS.maxArchiveEntries) throw new ArchiveError(`Archive has too many files (limit ${LIMITS.maxArchiveEntries})`);
    let total = 0;
    const wanted: string[] = [];
    let skipped = 0;
    for (const h of headers) {
      if (suspicious(h.name)) throw new ArchiveError("Archive contains unsafe file paths");
      if (h.flags.encrypted) {
        skipped++;
        continue;
      }
      if (h.unpSize > LIMITS.maxFileBytes || !ratioOk(h.packSize, h.unpSize)) {
        throw new ArchiveError("Archive rejected: file size or compression ratio exceeds safe limits");
      }
      total += h.unpSize;
      if (total > LIMITS.maxArchiveUncompressedBytes) throw new ArchiveError("Archive rejected: uncompressed size exceeds limit");
      wanted.push(h.name);
    }
    const { files } = extractor.extract({ files: wanted });
    const entries: ExtractedEntry[] = [];
    for (const f of files) if (f.extraction) entries.push({ name: f.fileHeader.name, data: Buffer.from(f.extraction) });
    return { entries, skipped };
  } catch (e) {
    if (e instanceof ArchiveError) throw e;
    throw new ArchiveError("The RAR archive is corrupted, encrypted or unsupported");
  }
}
