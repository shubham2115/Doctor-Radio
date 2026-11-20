import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";

/** Append-only audit trail. Never throws: auditing must not break the user flow. */
export async function audit(entry: {
  actorId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  ip?: string;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  try {
    await db.auditLog.create({ data: entry });
  } catch (err) {
    console.error("[audit] failed", err);
  }
}
