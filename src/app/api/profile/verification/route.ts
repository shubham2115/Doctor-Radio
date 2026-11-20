import { NextResponse } from "next/server";
import { apiUser } from "@/server/dal";
import { assertSameOrigin, limit, parseJson, route } from "@/server/http";
import { verificationSchema } from "@/lib/validation/profile";
import { submitVerification } from "@/server/services/profile";

export const POST = route(async (req) => {
  assertSameOrigin(req);
  const user = await apiUser();
  await limit(req, "verify", 5, 24 * 60 * 60);
  const { registrationNo, council } = await parseJson(req, verificationSchema);
  await submitVerification(user.id, registrationNo, council);
  return NextResponse.json({ ok: true }, { status: 201 });
});
