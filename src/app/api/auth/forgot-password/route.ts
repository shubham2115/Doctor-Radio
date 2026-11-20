import { NextResponse } from "next/server";
import { assertSameOrigin, limit, parseJson, route } from "@/server/http";
import { forgotSchema } from "@/lib/validation/auth";
import { createPasswordReset } from "@/server/services/account";
import { sendPasswordResetEmail } from "@/server/email";
import { clientIp } from "@/server/rate-limit";

export const POST = route(async (req) => {
  assertSameOrigin(req);
  await limit(req, "forgot", 5, 60 * 60);
  const { email } = await parseJson(req, forgotSchema);
  const token = await createPasswordReset(email, clientIp(req));
  if (token) {
    const base = process.env.AUTH_URL ?? new URL(req.url).origin;
    await sendPasswordResetEmail(email, `${base}/reset-password?token=${token}`);
  }
  // Identical response whether or not the account exists.
  return NextResponse.json({ ok: true });
});
