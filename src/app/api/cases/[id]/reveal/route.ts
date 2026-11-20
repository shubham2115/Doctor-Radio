import { NextResponse } from "next/server";
import { apiUser } from "@/server/dal";
import { assertSameOrigin, parseJson, routeWith } from "@/server/http";
import { revealSchema } from "@/lib/validation/engagement";
import { revealObservations } from "@/server/services/engagement";

export const POST = routeWith<{ id: string }>(async (req, { id }) => {
  assertSameOrigin(req);
  const u = await apiUser();
  const { skip } = await parseJson(req, revealSchema);
  await revealObservations(u.id, id, skip);
  return NextResponse.json({ revealed: true });
});
