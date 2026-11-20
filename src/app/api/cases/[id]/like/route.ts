import { NextResponse } from "next/server";
import { apiUser } from "@/server/dal";
import { assertSameOrigin, limit, routeWith } from "@/server/http";
import { setCaseLike } from "@/server/services/engagement";

export const POST = routeWith<{ id: string }>(async (req, { id }) => {
  assertSameOrigin(req);
  const u = await apiUser();
  await limit(req, "like", 300, 3600);
  await setCaseLike(u.id, id, true);
  return NextResponse.json({ liked: true });
});

export const DELETE = routeWith<{ id: string }>(async (req, { id }) => {
  assertSameOrigin(req);
  const u = await apiUser();
  await setCaseLike(u.id, id, false);
  return NextResponse.json({ liked: false });
});
