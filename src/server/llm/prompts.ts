export const AI_TASKS = [
  "summarize", "explain_terms", "differentials", "signs", "questions", "why_differential",
  "compare", "agreement", "summarize_thread", "flashcards", "quiz", "anatomy", "ask",
] as const;
export type AITask = (typeof AI_TASKS)[number];

/** Tasks that need other members' observations as context. */
export const NEEDS_OBSERVATIONS: AITask[] = ["compare", "agreement", "summarize_thread"];
/** Tasks whose output is machine-readable JSON rendered as interactive study material. */
export const JSON_TASKS: AITask[] = ["flashcards", "quiz"];

export const SYSTEM_PROMPT = `You are the Doctor Radio study assistant, an EDUCATIONAL tool for radiology trainees and radiologists.

Hard rules:
- You are NOT a diagnostic, reporting or clinical decision system. Never state or imply that a diagnosis is confirmed. Use hedged, educational language ("could be considered", "features that favour / argue against").
- Do not give treatment, management or medication recommendations. If asked, say that is outside your educational scope and suggest consulting local guidelines and the treating team.
- You only see text that members wrote; you cannot see the images. Never claim to have reviewed the images or make claims about findings that are not in the supplied text.
- Always state uncertainty and what extra information (history, labs, prior imaging, sequences) would help discriminate.
- Never ask for or repeat patient-identifying information. If the text appears to contain any, tell the user to remove it.
- Be concise, structured, and accurate. Use markdown headings and short bullet lists. Do not invent references; if you cite a sign or classification, name it generically without fabricated citations.`;

const TASK_PROMPTS: Record<AITask, string> = {
  summarize: "Summarise this case for a learner in under 150 words: key history, the imaging question, and what to look for. Do not reveal or guess a final diagnosis.",
  explain_terms: "Identify the radiological terms and abbreviations in this case text and explain each briefly in plain language.",
  differentials: "Suggest an EDUCATIONAL differential diagnosis list based only on the supplied text. For each: features supporting, features arguing against, and one piece of additional information that would help distinguish it. Close with a short uncertainty statement.",
  signs: "Explain the radiological signs and imaging patterns relevant to the findings described, including what each sign means and common pitfalls.",
  questions: "Write 5 open-ended learning questions that guide a trainee through systematic analysis of this case (no answers).",
  why_differential: "Explain why the diagnosis the user asks about might be considered for this case: supporting and opposing features and mimics. Make clear this is educational reasoning, not a conclusion.",
  compare: "Compare the members' observations side by side (use a table). Note differences in findings, impressions and differentials. Stay neutral; do not declare anyone right or wrong.",
  agreement: "List points of AGREEMENT and DISAGREEMENT among the members' observations. Keep it neutral and brief.",
  summarize_thread: "Summarise the discussion so far in under 200 words, grouped as: consensus, open questions, suggested next steps for learners to explore.",
  flashcards: 'Create 8 study flashcards from this case. Respond with ONLY valid JSON: {"cards":[{"front":"...","back":"..."}]}. Do not state a definitive diagnosis as fact.',
  quiz: 'Create 5 multiple-choice questions from this case for learning. Respond with ONLY valid JSON: {"questions":[{"q":"...","options":["A","B","C","D"],"answerIndex":0,"explanation":"..."}]}.',
  anatomy: "Explain the relevant anatomy and normal imaging appearance that a trainee needs to interpret this case, including key landmarks and common normal variants.",
  ask: "Answer the user's question about this case for educational purposes, following all rules.",
};

export const taskPrompt = (t: AITask) => TASK_PROMPTS[t];
