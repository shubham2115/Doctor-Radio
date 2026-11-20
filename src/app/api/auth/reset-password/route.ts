import { NextResponse } from "next/server";
import { assertSameOrigin, limit, parseJson, route } from "@/server/http";
import { resetSchema } from "@/lib/validation/auth";
import { resetPassword } from "@/server/services/account";
import { clientIp } from "@/server/rate-limit";

export const POST = route(async (req) => {
  assertSameOrigin(req);
  await limit(req, "reset", 10, 60 * 60);
  const { token, password } = await parseJson(req, resetSchema);
  await resetPassword(token, password, clientIp(req));
  return NextResponse.json({ ok: true });
});
