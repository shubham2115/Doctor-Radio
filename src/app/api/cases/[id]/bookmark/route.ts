import { NextResponse } from "next/server";
import { apiUser } from "@/server/dal";
import { assertSameOrigin, limit, routeWith } from "@/server/http";
import { setBookmark } from "@/server/services/engagement";

export const POST = routeWith<{ id: string }>(async (req, { id }) => {
  assertSameOrigin(req);
  const u = await apiUser();
  await limit(req, "bookmark", 300, 3600);
  await setBookmark(u.id, id, true);
  return NextResponse.json({ bookmarked: true });
});

export const DELETE = routeWith<{ id: string }>(async (req, { id }) => {
  assertSameOrigin(req);
  const u = await apiUser();
  await setBookmark(u.id, id, false);
  return NextResponse.json({ bookmarked: false });
});
