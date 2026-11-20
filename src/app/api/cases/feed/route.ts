import { NextResponse } from "next/server";
import { apiUser } from "@/server/dal";
import { HttpError, route } from "@/server/http";
import { exploreQuerySchema, searchCases } from "@/server/services/explore";

export const GET = route(async (req) => {
  await apiUser();
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = exploreQuerySchema.safeParse(params);
  if (!parsed.success) throw new HttpError(400, "Invalid filters");
  return NextResponse.json(await searchCases(parsed.data));
});
