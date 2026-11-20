/**
 * Provider-independent LLM access. Add a provider by implementing `LLMProvider` and registering it
 * in `getProvider()`. All adapters use plain fetch so there are no vendor SDK lock-ins.
 *
 * Privacy: only de-identified TEXT is ever sent (see guard.ts). Images/DICOM pixels never leave the
 * platform. Vendors' API tiers do not train on API traffic by default; keep it that way by never
 * enabling data-sharing/training options on the provider account.
 */
export type LLMMessage = { role: "user" | "assistant"; content: string };
export type LLMRequest = { system: string; messages: LLMMessage[]; maxTokens?: number; temperature?: number };
export type LLMResult = { text: string; inputTokens?: number; outputTokens?: number };

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  complete(req: LLMRequest): Promise<LLMResult>;
}

import { getLlmConfig } from "@/server/settings";

export class LLMNotConfigured extends Error {}
export class LLMUpstreamError extends Error {}

async function postJson(url: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000) });
  if (!res.ok) {
    console.error("[llm] upstream error", res.status, (await res.text()).slice(0, 300));
    throw new LLMUpstreamError("The AI provider returned an error. Please try again.");
  }
  return res.json();
}

const anthropic = (key: string, model: string): LLMProvider => ({
  name: "anthropic", model,
  async complete({ system, messages, maxTokens = 1500, temperature = 0.3 }) {
    const j = await postJson("https://api.anthropic.com/v1/messages", { "x-api-key": key, "anthropic-version": "2023-06-01" },
      { model, max_tokens: maxTokens, temperature, system, messages });
    return { text: (j.content ?? []).map((c: { text?: string }) => c.text ?? "").join(""), inputTokens: j.usage?.input_tokens, outputTokens: j.usage?.output_tokens };
  },
});

const openaiCompatible = (name: string, base: string, key: string, model: string): LLMProvider => ({
  name, model,
  async complete({ system, messages, maxTokens = 1500, temperature = 0.3 }) {
    const j = await postJson(`${base.replace(/\/$/, "")}/chat/completions`, { authorization: `Bearer ${key}` },
      { model, max_tokens: maxTokens, temperature, messages: [{ role: "system", content: system }, ...messages] });
    return { text: j.choices?.[0]?.message?.content ?? "", inputTokens: j.usage?.prompt_tokens, outputTokens: j.usage?.completion_tokens };
  },
});

const gemini = (key: string, model: string): LLMProvider => ({
  name: "gemini", model,
  async complete({ system, messages, maxTokens = 1500, temperature = 0.3 }) {
    const j = await postJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { "x-goog-api-key": key }, {
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: maxTokens, temperature },
    });
    const parts: { text?: string }[] = j.candidates?.[0]?.content?.parts ?? [];
    return { text: parts.map((p) => p.text ?? "").join(""), inputTokens: j.usageMetadata?.promptTokenCount, outputTokens: j.usageMetadata?.candidatesTokenCount };
  },
});

const cohere = (key: string, model: string): LLMProvider => ({
  name: "cohere", model,
  async complete({ system, messages, maxTokens = 1500, temperature = 0.3 }) {
    // Cohere v2 chat: system/user/assistant roles; reply text is in message.content[].text
    const j = await postJson("https://api.cohere.ai/v2/chat", { authorization: `Bearer ${key}`, accept: "application/json" },
      { model, max_tokens: maxTokens, temperature, stream: false, messages: [{ role: "system", content: system }, ...messages] });
    const parts: { type?: string; text?: string }[] = j.message?.content ?? [];
    return { text: parts.map((p) => p.text ?? "").join(""), inputTokens: j.usage?.tokens?.input_tokens, outputTokens: j.usage?.tokens?.output_tokens };
  },
});

export const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-5-5", openai: "gpt-4o-mini", gemini: "gemini-2.0-flash", cohere: "command-a-03-2025",
};

/** Builds the provider from UI-saved settings (preferred) or environment variables. */
export async function getProvider(): Promise<LLMProvider> {
  const c = await getLlmConfig();
  if (!c.apiKey) throw new LLMNotConfigured("The AI assistant is not configured yet. An administrator can add a provider and API key under Moderation → AI settings.");
  const model = c.model ?? DEFAULT_MODELS[c.provider];
  switch (c.provider) {
    case "anthropic": return anthropic(c.apiKey, model);
    case "openai": return openaiCompatible("openai", "https://api.openai.com/v1", c.apiKey, model);
    case "gemini": return gemini(c.apiKey, model);
    case "cohere": return cohere(c.apiKey, model);
    case "openai-compatible":
      if (!c.baseUrl || !c.model) throw new LLMNotConfigured("openai-compatible needs a base URL and a model name");
      return openaiCompatible("openai-compatible", c.baseUrl, c.apiKey, c.model);
    default: throw new LLMNotConfigured(`Unknown provider “${c.provider}”`);
  }
}

export async function llmConfigured() {
  return Boolean((await getLlmConfig()).apiKey);
}
