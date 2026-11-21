import { NextResponse } from "next/server";
import { apiUser } from "@/server/dal";
import { assertSameOrigin, limit, parseJson, route } from "@/server/http";
import { createUserByAdmin, createUserSchema } from "@/server/services/users";
import { clientIp } from "@/server/rate-limit";

export const POST = route(async (req) => {
  assertSameOrigin(req);
  const admin = await apiUser("ADMIN");
  await limit(req, "admin-user-create", 60, 3600);
  const input = await parseJson(req, createUserSchema);
  return NextResponse.json(await createUserByAdmin(admin, input, clientIp(req)), { status: 201 });
});
