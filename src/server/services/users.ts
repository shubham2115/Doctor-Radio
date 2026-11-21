import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Designation, Role } from "@prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { HttpError } from "@/server/http";
import { emailSchema, passwordSchema } from "@/lib/validation/auth";
import { DESIGNATIONS } from "@/lib/validation/profile";

const designations = DESIGNATIONS.map((d) => d.value) as [string, ...string[]];

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(["MEMBER", "MODERATOR", "ADMIN"]),
  designation: z.enum(designations),
  verified: z.boolean().default(false),
});

export const updateUserSchema = z
  .object({
    role: z.enum(["MEMBER", "MODERATOR", "ADMIN"]).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
    verified: z.boolean().optional(),
    password: passwordSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

type Actor = { id: string };

/** Unique username derived from the email's local part. */
async function freeUsername(email: string) {
  const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 24).padEnd(3, "_");
  let username = base;
  for (let i = 1; await db.userProfile.findUnique({ where: { username }, select: { userId: true } }); i++) username = `${base}${i}`;
  return username;
}

export async function createUserByAdmin(actor: Actor, input: z.infer<typeof createUserSchema>, ip: string) {
  const existing = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw new HttpError(409, "A user with this email already exists", { email: ["Email already registered"] });

  const passwordHash = await bcrypt.hash(input.password, 12);
  const username = await freeUsername(input.email);
  const user = await db.$transaction(async (tx) => {
    const u = await tx.user.create({ data: { email: input.email, name: input.name, passwordHash, role: input.role as Role, emailVerified: new Date() } });
    await tx.userProfile.create({
      data: {
        userId: u.id, username, displayName: input.name, designation: input.designation as Designation, interests: [], onboardingDone: true,
        verificationStatus: input.verified ? "VERIFIED" : "UNVERIFIED", verifiedAt: input.verified ? new Date() : null,
      },
    });
    return u;
  });
  await audit({ actorId: actor.id, action: "user.created", entity: "User", entityId: user.id, ip, metadata: { role: input.role, verified: input.verified } });
  return { id: user.id, username };
}

async function otherActiveAdmins(excludeId: string) {
  return db.user.count({ where: { role: "ADMIN", status: "ACTIVE", id: { not: excludeId } } });
}

export async function updateUserByAdmin(actor: Actor, targetId: string, input: z.infer<typeof updateUserSchema>, ip: string) {
  const target = await db.user.findUnique({ where: { id: targetId }, include: { profile: true } });
  if (!target || target.status === "DELETED") throw new HttpError(404, "User not found");

  // Self-protection: an admin can't demote or suspend themselves (they could lock everyone out).
  if (targetId === actor.id && (input.role !== undefined || input.status !== undefined)) {
    throw new HttpError(400, "You can't change your own role or suspend yourself. Ask another admin.");
  }
  // Never leave the platform without an active admin.
  const losesAdmin = target.role === "ADMIN" && ((input.role && input.role !== "ADMIN") || input.status === "SUSPENDED");
  if (losesAdmin && (await otherActiveAdmins(targetId)) === 0) throw new HttpError(400, "This is the last active admin. Promote another admin first.");
  if (input.verified !== undefined && !target.profile) throw new HttpError(409, "This user hasn't completed their profile yet");

  const ops = [];
  const changes: Record<string, unknown> = {};
  const data: { role?: Role; status?: "ACTIVE" | "SUSPENDED"; passwordHash?: string; failedLogins?: number; lockedUntil?: null } = {};
  if (input.role && input.role !== target.role) { data.role = input.role as Role; changes.role = { from: target.role, to: input.role }; }
  if (input.status && input.status !== target.status) { data.status = input.status; changes.status = { from: target.status, to: input.status }; }
  if (input.password) { data.passwordHash = await bcrypt.hash(input.password, 12); data.failedLogins = 0; data.lockedUntil = null; changes.passwordReset = true; }
  if (Object.keys(data).length) ops.push(db.user.update({ where: { id: targetId }, data }));

  if (input.verified !== undefined && target.profile) {
    const status = input.verified ? "VERIFIED" : "UNVERIFIED";
    if (target.profile.verificationStatus !== status) {
      ops.push(db.userProfile.update({ where: { userId: targetId }, data: { verificationStatus: status, verifiedAt: input.verified ? new Date() : null } }));
      changes.verification = { from: target.profile.verificationStatus, to: status };
    }
  }
  if (changes.status) {
    ops.push(db.moderationAction.create({ data: { moderatorId: actor.id, type: input.status === "SUSPENDED" ? "SUSPEND_USER" : "REINSTATE_USER", targetType: "User", targetId } }));
  }
  if (changes.verification && input.verified) {
    ops.push(db.moderationAction.create({ data: { moderatorId: actor.id, type: "VERIFY_USER", targetType: "User", targetId } }));
  }
  if (!ops.length) return;
  await db.$transaction(ops);
  // Suspended users are signed out on their next request: the session callback re-checks status.
  await audit({ actorId: actor.id, action: "user.updated", entity: "User", entityId: targetId, ip, metadata: JSON.parse(JSON.stringify(changes)) });
}
