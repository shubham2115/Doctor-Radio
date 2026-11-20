import { db } from "@/server/db";
import { HttpError } from "@/server/http";
import { scanTextForPHI } from "@/server/phi";
import { getProvider, LLMNotConfigured, LLMUpstreamError } from "@/server/llm/providers";
import { JSON_TASKS, NEEDS_OBSERVATIONS, SYSTEM_PROMPT, taskPrompt, type AITask } from "@/server/llm/prompts";
import { touchStreak } from "./points";

/**
 * Builds the text context for the model from a PUBLISHED, de-identified case. Deliberately excludes:
 * images, filenames, author identity, and the author's reference diagnosis (to avoid spoilers).
 * Other members appear only as "Reader N".
 */
async function buildContext(caseId: string, userId: string, withObservations: boolean) {
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: {
      observations: { where: { deletedAt: null }, orderBy: { createdAt: "asc" }, include: { differentials: true } },
      comments: { where: { deletedAt: null }, orderBy: { createdAt: "asc" }, take: 60 },
    },
  });
  if (!c || c.deletedAt || c.status !== "PUBLISHED") throw new HttpError(404, "Case not found");

  let ctx = `CASE\nTitle: ${c.title}\nModality: ${c.modality}\nRegion: ${c.bodyRegion}\nAge range: ${c.patientAgeRange ?? "n/a"}\nClinical history: ${c.clinicalHistory}\n`;
  if (c.clinicalInfo) ctx += `Additional clinical info: ${c.clinicalInfo}\n`;
  if (c.imagingFindings) ctx += `Described imaging findings: ${c.imagingFindings}\n`;

  if (withObservations) {
    // Reveal-mode integrity: AI must not leak others' reads to someone who hasn't unlocked them.
    const unlocked = c.authorId === userId || (await db.observationReveal.findUnique({ where: { userId_caseId: { userId, caseId } } }));
    if (!unlocked) throw new HttpError(403, "Submit your observation or reveal others' observations first");
    const label = new Map<string, string>();
    const reader = (id: string) => label.get(id) ?? (label.set(id, `Reader ${label.size + 1}`), label.get(id)!);
    ctx += "\nOBSERVATIONS\n";
    for (const o of c.observations) {
      ctx += `${reader(o.authorId)} — Findings: ${o.findings}`;
      if (o.impression) ctx += ` | Impression: ${o.impression}`;
      if (o.differentials.length) ctx += ` | Differentials: ${o.differentials.map((d) => d.diagnosis).join("; ")}`;
      ctx += "\n";
    }
    if (c.comments.length) ctx += "\nDISCUSSION\n" + c.comments.map((m) => `${reader(m.authorId)}: ${m.body}`).join("\n") + "\n";
  }
  return ctx;
}

export type AIReply = { conversationId: string; messageId: string; task: AITask; content: string; provider: string; model: string };

export async function runAssistant(userId: string, caseId: string, task: AITask, question: string | undefined, conversationId?: string): Promise<AIReply> {
  if (task === "ask" || task === "why_differential") {
    if (!question?.trim()) throw new HttpError(422, "Type a question first");
  }
  const provider = await getProvider().catch((e) => {
    if (e instanceof LLMNotConfigured) throw new HttpError(503, e.message);
    throw e;
  });

  const context = await buildContext(caseId, userId, NEEDS_OBSERVATIONS.includes(task));

  // PHI guard: nothing identifiable is sent to an external provider. Fail closed.
  const hits = scanTextForPHI(context, question);
  if (hits.length) {
    throw new HttpError(422, `This case text appears to contain patient identifiers (${hits.join(", ")}), so it can't be sent to the AI provider. Ask a moderator to review it.`);
  }

  const convo = conversationId
    ? await db.aIConversation.findFirst({ where: { id: conversationId, userId, caseId }, include: { messages: { orderBy: { createdAt: "asc" }, take: 12 } } })
    : null;
  if (conversationId && !convo) throw new HttpError(404, "Conversation not found");

  const userPrompt = `${taskPrompt(task)}\n\n${question ? `User question: ${question.trim()}\n\n` : ""}${context}`;
  const history = (convo?.messages ?? []).filter((m) => !JSON_TASKS.includes((m.task ?? "") as AITask)).map((m) => ({ role: m.role === "USER" ? ("user" as const) : ("assistant" as const), content: m.content }));

  let text: string, inputTokens: number | undefined, outputTokens: number | undefined;
  try {
    ({ text, inputTokens, outputTokens } = await provider.complete({
      system: SYSTEM_PROMPT, messages: [...history, { role: "user", content: userPrompt }],
      maxTokens: JSON_TASKS.includes(task) ? 2500 : 1500, temperature: JSON_TASKS.includes(task) ? 0.4 : 0.3,
    }));
  } catch (e) {
    if (e instanceof LLMUpstreamError) throw new HttpError(502, e.message);
    throw e;
  }
  if (!text.trim()) throw new HttpError(502, "The AI provider returned an empty response");
  if (JSON_TASKS.includes(task)) {
    // Validate structured output; strip code fences models sometimes add.
    text = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    try { JSON.parse(text); } catch { throw new HttpError(502, "The AI returned malformed study material. Please try again."); }
  }

  return db.$transaction(async (tx) => {
    const conversation = convo ?? (await tx.aIConversation.create({ data: { userId, caseId, provider: provider.name, model: provider.model } }));
    await tx.aIMessage.create({ data: { conversationId: conversation.id, role: "USER", content: question?.trim() || task, task } });
    const reply = await tx.aIMessage.create({ data: { conversationId: conversation.id, role: "ASSISTANT", content: text, task, inputTokens, outputTokens } });
    await touchStreak(tx, userId);
    return { conversationId: conversation.id, messageId: reply.id, task, content: text, provider: provider.name, model: provider.model };
  });
}
