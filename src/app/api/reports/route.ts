import { NextResponse } from "next/server";
import { apiUser } from "@/server/dal";
import { assertSameOrigin, limit, parseJson, route } from "@/server/http";
import { reportSchema } from "@/lib/validation/engagement";
import { fileReport } from "@/server/services/engagement";

export const POST = route(async (req) => {
  assertSameOrigin(req);
  const u = await apiUser();
  await limit(req, "report", 30, 3600);
  const r = await parseJson(req, reportSchema);
  await fileReport(u.id, r.targetType, r.targetId, r.reason, r.details);
  return NextResponse.json({ ok: true }, { status: 201 });
});
