import { NextResponse } from "next/server";
import { apiUser } from "@/server/dal";
import { assertSameOrigin, limit, parseJson, route } from "@/server/http";
import { profileSchema } from "@/lib/validation/profile";
import { upsertProfile } from "@/server/services/profile";

export const PUT = route(async (req) => {
  assertSameOrigin(req);
  const user = await apiUser();
  await limit(req, "profile", 30, 60 * 60);
  const input = await parseJson(req, profileSchema);
  const profile = await upsertProfile(user.id, input);
  return NextResponse.json({ username: profile.username });
});
