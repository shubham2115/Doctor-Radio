import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/server/dal";
import { db } from "@/server/db";
import { assertSameOrigin, HttpError, parseJson, route } from "@/server/http";
import { audit } from "@/server/audit";
import { clientIp } from "@/server/rate-limit";

const schema = z.object({ decision: z.enum(["approve", "reject"]), note: z.string().trim().max(500).optional() });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return route(async () => {
    assertSameOrigin(req);
    const mod = await apiUser("MODERATOR");
    const { decision, note } = await parseJson(req, schema);
    const id = (await ctx.params).id;
    const v = await db.verificationRequest.findUnique({ where: { id } });
    if (!v || v.status !== "PENDING") throw new HttpError(409, "Request is not pending");
    const status = decision === "approve" ? "VERIFIED" : "REJECTED";

    await db.$transaction([
      db.verificationRequest.update({ where: { id }, data: { status, reviewerNote: note, reviewedById: mod.id, reviewedAt: new Date() } }),
      db.userProfile.update({ where: { userId: v.userId }, data: { verificationStatus: status, verifiedAt: status === "VERIFIED" ? new Date() : null } }),
      db.moderationAction.create({ data: { moderatorId: mod.id, type: decision === "approve" ? "VERIFY_USER" : "REJECT_VERIFICATION", targetType: "User", targetId: v.userId, reason: note } }),
      db.notification.create({
        data: { recipientId: v.userId, actorId: mod.id, type: "VERIFICATION_UPDATE", message: decision === "approve" ? "verified your professional credentials" : `could not verify your credentials${note ? `: ${note}` : ""}` },
      }),
    ]);
    await audit({ actorId: mod.id, action: `verification.${decision}`, entity: "User", entityId: v.userId, ip: clientIp(req) });
    return NextResponse.json({ ok: true });
  })(req);
}
