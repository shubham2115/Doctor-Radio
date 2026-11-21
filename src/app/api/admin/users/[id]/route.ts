import { NextResponse } from "next/server";
import { apiUser } from "@/server/dal";
import { assertSameOrigin, limit, parseJson, routeWith } from "@/server/http";
import { updateUserByAdmin, updateUserSchema } from "@/server/services/users";
import { clientIp } from "@/server/rate-limit";

export const PATCH = routeWith<{ id: string }>(async (req, { id }) => {
  assertSameOrigin(req);
  const admin = await apiUser("ADMIN");
  await limit(req, "admin-user-update", 300, 3600);
  const input = await parseJson(req, updateUserSchema);
  await updateUserByAdmin(admin, id, input, clientIp(req));
  return NextResponse.json({ ok: true });
});
