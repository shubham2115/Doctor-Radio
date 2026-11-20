import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/server/dal";
import { assertSameOrigin, limit, parseJson, routeWith } from "@/server/http";
import { runAssistant } from "@/server/services/ai";
import { AI_TASKS } from "@/server/llm/prompts";

export const maxDuration = 90;

const schema = z.object({
  task: z.enum(AI_TASKS),
  question: z.string().trim().max(1000).optional(),
  conversationId: z.string().min(1).optional(),
});

export const POST = routeWith<{ id: string }>(async (req, { id }) => {
  assertSameOrigin(req);
  const u = await apiUser();
  await limit(req, `ai:${u.id}`, 40, 3600);
  const { task, question, conversationId } = await parseJson(req, schema);
  return NextResponse.json(await runAssistant(u.id, id, task, question, conversationId));
});
