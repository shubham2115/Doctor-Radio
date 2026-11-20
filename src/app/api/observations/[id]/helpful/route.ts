import { NextResponse } from "next/server";
import { apiUser } from "@/server/dal";
import { assertSameOrigin, limit, routeWith } from "@/server/http";
import { setHelpful } from "@/server/services/engagement";

export const POST = routeWith<{ id: string }>(async (req, { id }) => {
  assertSameOrigin(req);
  const u = await apiUser();
  await limit(req, "helpful", 200, 3600);
  await setHelpful(u.id, id, true);
  return NextResponse.json({ helpful: true });
});

export const DELETE = routeWith<{ id: string }>(async (req, { id }) => {
  assertSameOrigin(req);
  const u = await apiUser();
  await setHelpful(u.id, id, false);
  return NextResponse.json({ helpful: false });
});
