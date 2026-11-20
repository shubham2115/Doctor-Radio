import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/server/dal";
import { assertSameOrigin, parseJson, route } from "@/server/http";
import { reviewCase } from "@/server/services/cases";
import { clientIp } from "@/server/rate-limit";

const schema = z.object({ decision: z.enum(["approve", "reject"]), reason: z.string().trim().max(500).optional() });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return route(async () => {
    assertSameOrigin(req);
    const mod = await apiUser("MODERATOR");
    const { decision, reason } = await parseJson(req, schema);
    await reviewCase(mod.id, (await ctx.params).id, decision, reason, clientIp(req));
    return NextResponse.json({ ok: true });
  })(req);
}
