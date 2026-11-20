import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/server/dal";
import { assertSameOrigin, parseJson, routeWith } from "@/server/http";
import { deleteComment, editComment } from "@/server/services/engagement";

export const PATCH = routeWith<{ id: string }>(async (req, { id }) => {
  assertSameOrigin(req);
  const u = await apiUser();
  const { body } = await parseJson(req, z.object({ body: z.string().trim().min(1).max(4000) }));
  await editComment(u.id, id, body);
  return NextResponse.json({ ok: true });
});

export const DELETE = routeWith<{ id: string }>(async (req, { id }) => {
  assertSameOrigin(req);
  const u = await apiUser();
  await deleteComment(u, id);
  return NextResponse.json({ ok: true });
});
