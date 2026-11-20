import { NextResponse } from "next/server";
import { apiUser } from "@/server/dal";
import { assertSameOrigin, limit, parseJson, routeWith } from "@/server/http";
import { commentSchema } from "@/lib/validation/engagement";
import { createComment } from "@/server/services/engagement";

export const POST = routeWith<{ id: string }>(async (req, { id }) => {
  assertSameOrigin(req);
  const u = await apiUser();
  await limit(req, "comment", 120, 3600);
  const { body, parentId, observationId } = await parseJson(req, commentSchema);
  const c = await createComment(u.id, id, body, parentId, observationId);
  return NextResponse.json({ id: c.id }, { status: 201 });
});
