import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/server/dal";
import { assertSameOrigin, limit, parseJson, route } from "@/server/http";
import { getLlmConfigPublic, LLM_PROVIDERS, saveLlmConfig } from "@/server/settings";
import { audit } from "@/server/audit";
import { clientIp } from "@/server/rate-limit";

const schema = z.object({
  provider: z.enum(LLM_PROVIDERS),
  model: z.string().trim().max(100).optional().or(z.literal("")),
  baseUrl: z.string().trim().max(300).refine((u) => u === "" || /^https?:\/\/[^\s]+$/.test(u), "Must be an http(s) URL").optional(),
  apiKey: z.string().trim().max(500).optional().or(z.literal("")),
  clearKey: z.boolean().optional(),
});

/** Admin only (not moderators): configuring the AI provider changes where case text is sent. */
export const GET = route(async () => {
  await apiUser("ADMIN");
  return NextResponse.json(await getLlmConfigPublic());
});

export const PUT = route(async (req) => {
  assertSameOrigin(req);
  const admin = await apiUser("ADMIN");
  await limit(req, "llm-settings", 30, 3600);
  const input = await parseJson(req, schema);
  await saveLlmConfig(input, admin.id);
  // Audit the change, never the secret.
  await audit({
    actorId: admin.id, action: "settings.llm_updated", entity: "AppSetting", entityId: "llm", ip: clientIp(req),
    metadata: { provider: input.provider, model: input.model || null, keyChanged: Boolean(input.apiKey), keyCleared: Boolean(input.clearKey) },
  });
  return NextResponse.json(await getLlmConfigPublic());
});
