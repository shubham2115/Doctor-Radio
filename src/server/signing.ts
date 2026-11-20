import crypto from "node:crypto";

const TTL_SECONDS = 15 * 60;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is required for signed URLs");
  return s;
}

const mac = (fileId: string, variant: string, exp: number) =>
  crypto.createHmac("sha256", secret()).update(`${fileId}.${variant}.${exp}`).digest("base64url");

/** Short-lived signed URL for a private file. Access is additionally checked against the session on read. */
export function signedFileUrl(fileId: string, variant: "full" | "thumb" = "full") {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  return `/api/files/${fileId}?v=${variant}&exp=${exp}&sig=${mac(fileId, variant, exp)}`;
}

export function verifySignature(fileId: string, variant: string, exp: number, sig: string) {
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  const expected = Buffer.from(mac(fileId, variant, exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
