import { NextResponse } from "next/server";
import { apiUser } from "@/server/dal";
import { assertSameOrigin, limit, parseJson, routeWith } from "@/server/http";
import { observationSchema } from "@/lib/validation/engagement";
import { deleteObservation, upsertObservation } from "@/server/services/engagement";

export const PUT = routeWith<{ id: string }>(async (req, { id }) => {
  assertSameOrigin(req);
  const u = await apiUser();
  await limit(req, "observation", 60, 3600);
  const input = await parseJson(req, observationSchema);
  return NextResponse.json(await upsertObservation(u.id, id, input));
});

export const DELETE = routeWith<{ id: string }>(async (req, { id }) => {
  assertSameOrigin(req);
  const u = await apiUser();
  await deleteObservation(u.id, id);
  return NextResponse.json({ ok: true });
});
