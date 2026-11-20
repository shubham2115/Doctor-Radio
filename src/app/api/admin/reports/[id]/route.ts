import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/server/dal";
import { db } from "@/server/db";
import { assertSameOrigin, HttpError, parseJson, routeWith } from "@/server/http";
import { audit } from "@/server/audit";
import { clientIp } from "@/server/rate-limit";

const schema = z.object({ action: z.enum(["dismiss", "remove"]) });

export const POST = routeWith<{ id: string }>(async (req, { id }) => {
  assertSameOrigin(req);
  const mod = await apiUser("MODERATOR");
  const { action } = await parseJson(req, schema);
  const r = await db.report.findUnique({ where: { id } });
  if (!r || r.status === "RESOLVED" || r.status === "DISMISSED") throw new HttpError(409, "Report already handled");

  await db.$transaction(async (tx) => {
    if (action === "remove") {
      const now = new Date();
      if (r.targetType === "COMMENT") {
        const c = await tx.comment.findUnique({ where: { id: r.targetId } });
        if (c && !c.deletedAt) {
          await tx.comment.update({ where: { id: c.id }, data: { deletedAt: now } });
          await tx.case.update({ where: { id: c.caseId }, data: { commentCount: { decrement: 1 } } });
        }
      } else if (r.targetType === "OBSERVATION") {
        const o = await tx.observation.findUnique({ where: { id: r.targetId } });
        if (o && !o.deletedAt) {
          await tx.observation.update({ where: { id: o.id }, data: { deletedAt: now } });
          await tx.case.update({ where: { id: o.caseId }, data: { observationCount: { decrement: 1 } } });
        }
      } else if (r.targetType === "CASE") {
        await tx.case.update({ where: { id: r.targetId }, data: { status: "REMOVED" } });
      }
    }
    // Resolve every open report on the same target.
    await tx.report.updateMany({
      where: { targetType: r.targetType, targetId: r.targetId, status: { in: ["OPEN", "REVIEWING"] } },
      data: { status: action === "remove" ? "RESOLVED" : "DISMISSED", resolvedAt: new Date() },
    });
    await tx.moderationAction.create({
      data: { moderatorId: mod.id, type: action === "remove" ? "REMOVE_CONTENT" : "DISMISS_REPORT", targetType: r.targetType, targetId: r.targetId, reason: r.reason },
    });
  });
  await audit({ actorId: mod.id, action: `report.${action}`, entity: r.targetType, entityId: r.targetId, ip: clientIp(req) });
  return NextResponse.json({ ok: true });
});
