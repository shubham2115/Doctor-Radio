import { NextResponse } from "next/server";
import { assertSameOrigin, limit, parseJson, route } from "@/server/http";
import { registerSchema } from "@/lib/validation/auth";
import { registerUser } from "@/server/services/account";
import { clientIp } from "@/server/rate-limit";

export const POST = route(async (req) => {
  assertSameOrigin(req);
  await limit(req, "register", 10, 60 * 60);
  const input = await parseJson(req, registerSchema);
  await registerUser(input, clientIp(req));
  return NextResponse.json({ ok: true }, { status: 201 });
});
