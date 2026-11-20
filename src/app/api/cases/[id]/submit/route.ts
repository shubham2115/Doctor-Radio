import { NextResponse } from "next/server";
import { apiUser } from "@/server/dal";
import { assertSameOrigin, limit, parseJson, route } from "@/server/http";
import { submitSchema } from "@/lib/validation/case";
import { submitCase } from "@/server/services/cases";
import { clientIp } from "@/server/rate-limit";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return route(async () => {
    assertSameOrigin(req);
    const user = await apiUser();
    await limit(req, "case-submit", 30, 60 * 60);
    const input = await parseJson(req, submitSchema);
    await submitCase(user.id, (await ctx.params).id, input, clientIp(req));
    return NextResponse.json({ ok: true });
  })(req);
}
