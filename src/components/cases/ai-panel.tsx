"use client";
import { useRef, useState } from "react";
import { Bot, Brain, GitCompare, HelpCircle, Layers, ListChecks, MessagesSquare, Microscope, PenLine, Send, Sparkles, Stethoscope, Type } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { StudySet } from "@/components/learning/study-set";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type Task = "summarize" | "explain_terms" | "differentials" | "signs" | "questions" | "why_differential" | "compare" | "agreement" | "summarize_thread" | "flashcards" | "quiz" | "anatomy" | "ask";
type Reply = { conversationId: string; messageId: string; task: Task; content: string; provider: string; model: string };
type Entry = { id: string; label: string; reply?: Reply; error?: string };

const CHIPS: { task: Task; label: string; icon: React.ElementType; needsUnlock?: boolean; needsQuestion?: string }[] = [
  { task: "summarize", label: "Summarise case", icon: Sparkles },
  { task: "differentials", label: "Educational differentials", icon: Stethoscope },
  { task: "explain_terms", label: "Explain terminology", icon: Type },
  { task: "signs", label: "Explain signs", icon: Microscope },
  { task: "anatomy", label: "Anatomy & patterns", icon: Layers },
  { task: "questions", label: "Learning questions", icon: HelpCircle },
  { task: "flashcards", label: "Flashcards", icon: ListChecks },
  { task: "quiz", label: "Quiz me", icon: Brain },
  { task: "compare", label: "Compare observations", icon: GitCompare, needsUnlock: true },
  { task: "agreement", label: "Agreement / disagreement", icon: GitCompare, needsUnlock: true },
  { task: "summarize_thread", label: "Summarise discussion", icon: MessagesSquare, needsUnlock: true },
];

export function AiPanel({ caseId, unlocked, configured, onUseDraft }: { caseId: string; unlocked: boolean; configured: boolean; onUseDraft: (text: string) => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const convo = useRef<string | undefined>(undefined);
  const end = useRef<HTMLDivElement>(null);

  async function run(task: Task, label: string, q?: string) {
    setBusy(true);
    const id = crypto.randomUUID();
    setEntries((p) => [...p, { id, label }]);
    try {
      const reply = await api<Reply>(`/api/cases/${caseId}/ai`, "POST", { task, question: q, conversationId: convo.current });
      convo.current = reply.conversationId;
      setEntries((p) => p.map((e) => (e.id === id ? { ...e, reply } : e)));
    } catch (e) {
      setEntries((p) => p.map((x) => (x.id === id ? { ...x, error: e instanceof ApiError ? e.message : "Something went wrong" } : x)));
    } finally { setBusy(false); setTimeout(() => end.current?.scrollIntoView({ behavior: "smooth" }), 50); }
  }

  const ask = (e: React.FormEvent) => { e.preventDefault(); const q = question.trim(); if (!q) return; setQuestion(""); run("ask", q, q); };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-accent/30 bg-accent-soft p-3.5 text-xs leading-relaxed">
        <p className="flex items-center gap-1.5 font-semibold text-accent"><Bot className="h-4 w-4" />AI study assistant — educational only</p>
        <p className="mt-1 text-muted">It reads the case text (never the images or any patient data), can be wrong, never confirms a diagnosis and gives no treatment advice. Nothing it writes is published unless you edit and submit it yourself.</p>
      </div>
      {!configured && <p className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">The AI assistant isn&apos;t configured on this server yet. An administrator can enable it under Moderation → AI settings.</p>}

      <div className="flex flex-wrap gap-1.5">
        {CHIPS.map(({ task, label, icon: Icon, needsUnlock }) => (
          <Button key={task} size="sm" variant="secondary" disabled={busy || !configured || (needsUnlock && !unlocked)} title={needsUnlock && !unlocked ? "Unlock other observations first" : undefined} onClick={() => run(task, label)}>
            <Icon className="h-3.5 w-3.5" />{label}
          </Button>
        ))}
      </div>

      <div className="space-y-4">
        {entries.map((e) => (
          <div key={e.id} className="space-y-2">
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-navy px-3.5 py-2 text-sm text-white dark:bg-surface-2">{e.label}</p>
            {!e.reply && !e.error && <div className="flex items-center gap-2 text-sm text-muted"><span className="h-2 w-2 animate-pulse rounded-full bg-accent" />Thinking…</div>}
            {e.error && <p role="alert" className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{e.error}</p>}
            {e.reply && (
              <div className="rounded-2xl rounded-bl-md border border-border bg-surface p-4">
                <div className="mb-2 flex items-center gap-2"><Badge tone="accent"><Bot className="h-3 w-3" />AI-generated</Badge><span className="text-[11px] text-subtle">{e.reply.provider} · {e.reply.model}</span></div>
                {e.reply.task === "flashcards" || e.reply.task === "quiz" ? <StudySet kind={e.reply.task} raw={e.reply.content} /> : <Markdown>{e.reply.content}</Markdown>}
                <p className="mt-3 text-[11px] italic text-subtle">Educational suggestion — not a diagnosis. Verify against references and clinical context.</p>
                {e.reply.task !== "flashcards" && e.reply.task !== "quiz" && (
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => { onUseDraft(e.reply!.content); toast.success("Copied into the observation editor as a draft — edit before posting"); }}>
                    <PenLine className="h-3.5 w-3.5" />Use as draft notes
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>

      <form onSubmit={ask} className="sticky bottom-0 flex gap-2 bg-bg/90 pb-1 pt-2 backdrop-blur">
        <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1000} disabled={!configured || busy}
          placeholder="Ask e.g. “What are the possible differentials for these findings?”"
          className={cn("h-10 flex-1 rounded-[10px] border border-border bg-surface px-3 text-sm placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-4 focus:ring-[var(--ring)] disabled:opacity-60")} />
        <Button type="submit" size="icon" className="h-10 w-10" disabled={!configured || busy || !question.trim()} aria-label="Send"><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}
