import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { HttpError } from "@/server/http";
import type { RegisterInput } from "@/lib/validation/auth";

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function registerUser(input: RegisterInput, ip: string) {
  const existing = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
  // Registration must tell the user the email is taken (UX), so this endpoint can reveal
  // registered emails; it is rate limited per IP to make bulk enumeration impractical.
  if (existing) throw new HttpError(409, "An account with this email already exists", { email: ["Email already registered"] });

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await db.user.create({
    data: { email: input.email, name: input.name, passwordHash },
    select: { id: true },
  });
  await audit({ actorId: user.id, action: "auth.register", entity: "User", entityId: user.id, ip });
  return user;
}

/** Always resolves quietly so callers cannot enumerate accounts. Returns the raw token only for dev logging. */
export async function createPasswordReset(email: string, ip: string) {
  const user = await db.user.findUnique({ where: { email }, select: { id: true, status: true } });
  if (!user || user.status !== "ACTIVE") return null;

  const raw = crypto.randomBytes(32).toString("base64url");
  await db.passwordResetToken.create({
    data: { userId: user.id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 30 * 60_000) },
  });
  await audit({ actorId: user.id, action: "auth.reset_requested", entity: "User", entityId: user.id, ip });
  return raw;
}

export async function resetPassword(token: string, password: string, ip: string) {
  const record = await db.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new HttpError(400, "This reset link is invalid or has expired");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash, failedLogins: 0, lockedUntil: null } }),
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Invalidate any other outstanding reset links.
    db.passwordResetToken.updateMany({ where: { userId: record.userId, usedAt: null }, data: { usedAt: new Date() } }),
  ]);
  await audit({ actorId: record.userId, action: "auth.password_reset", entity: "User", entityId: record.userId, ip });
}
