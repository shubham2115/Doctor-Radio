import { NextResponse } from "next/server";
import { apiUser } from "@/server/dal";
import { assertSameOrigin, HttpError, limit, route } from "@/server/http";
import { getProvider, LLMNotConfigured, LLMUpstreamError } from "@/server/llm/providers";

/** Sends one tiny, non-medical prompt to verify the saved key and model work. */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  await apiUser("ADMIN");
  await limit(req, "llm-test", 20, 3600);
  try {
    const p = await getProvider();
    const r = await p.complete({ system: "You are a connectivity test.", messages: [{ role: "user", content: "Reply with the single word: OK" }], maxTokens: 20, temperature: 0 });
    return NextResponse.json({ ok: true, provider: p.name, model: p.model, reply: r.text.trim().slice(0, 40) });
  } catch (e) {
    if (e instanceof LLMNotConfigured) throw new HttpError(400, e.message);
    if (e instanceof LLMUpstreamError) throw new HttpError(502, "The provider rejected the request. Check the API key, model name and account access.");
    throw e;
  }
});
