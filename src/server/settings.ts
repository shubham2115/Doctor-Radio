import { db } from "@/server/db";
import { decryptSecret, encryptSecret } from "@/server/crypto";

export const LLM_PROVIDERS = ["anthropic", "openai", "gemini", "cohere", "openai-compatible"] as const;
export type LlmProviderId = (typeof LLM_PROVIDERS)[number];

export type LlmConfig = { provider: LlmProviderId; model?: string; baseUrl?: string; apiKey?: string; source: "ui" | "env" | "none" };
type Stored = { provider: LlmProviderId; model?: string; baseUrl?: string; apiKeyEnc?: string };

const KEY = "llm";

async function readStored(): Promise<Stored | null> {
  const row = await db.appSetting.findUnique({ where: { key: KEY } });
  if (!row) return null;
  try { return JSON.parse(row.value) as Stored; } catch { return null; }
}

/** UI-saved settings win; environment variables remain as a fallback for first boot / CI. */
export async function getLlmConfig(): Promise<LlmConfig> {
  const s = await readStored();
  if (s?.apiKeyEnc) {
    try {
      return { provider: s.provider, model: s.model || undefined, baseUrl: s.baseUrl || undefined, apiKey: decryptSecret(s.apiKeyEnc), source: "ui" };
    } catch (e) {
      console.error("[settings] could not decrypt stored LLM key (AUTH_SECRET changed?)", e);
    }
  }
  if (process.env.LLM_API_KEY) {
    return { provider: ((process.env.LLM_PROVIDER ?? "anthropic").toLowerCase() as LlmProviderId), model: process.env.LLM_MODEL || undefined, baseUrl: process.env.LLM_BASE_URL || undefined, apiKey: process.env.LLM_API_KEY, source: "env" };
  }
  return { provider: s?.provider ?? "anthropic", model: s?.model, baseUrl: s?.baseUrl, source: "none" };
}

/** Safe-to-render view: never includes the key itself. */
export async function getLlmConfigPublic() {
  const c = await getLlmConfig();
  return { provider: c.provider, model: c.model ?? "", baseUrl: c.baseUrl ?? "", source: c.source, keyHint: c.apiKey ? `••••${c.apiKey.slice(-4)}` : null };
}

export async function saveLlmConfig(input: { provider: LlmProviderId; model?: string; baseUrl?: string; apiKey?: string; clearKey?: boolean }, userId: string) {
  const prev = await readStored();
  let apiKeyEnc = prev?.apiKeyEnc;
  if (input.clearKey) apiKeyEnc = undefined;
  if (input.apiKey) apiKeyEnc = encryptSecret(input.apiKey.trim());
  const next: Stored = { provider: input.provider, model: input.model?.trim() || undefined, baseUrl: input.baseUrl?.trim() || undefined, apiKeyEnc };
  await db.appSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: JSON.stringify(next), updatedById: userId }, update: { value: JSON.stringify(next), updatedById: userId } });
}
