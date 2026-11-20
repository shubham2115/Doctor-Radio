"use client";
import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Cards = { cards: { front: string; back: string }[] };
type Quiz = { questions: { q: string; options: string[]; answerIndex: number; explanation?: string }[] };

/** Defensive parse: AI output is untrusted, so shape is validated before rendering. */
export function parseStudySet(kind: "flashcards" | "quiz", raw: string): Cards | Quiz | null {
  try {
    const j = JSON.parse(raw);
    if (kind === "flashcards" && Array.isArray(j.cards) && j.cards.every((c: { front?: unknown; back?: unknown }) => typeof c.front === "string" && typeof c.back === "string")) return { cards: j.cards.slice(0, 30) };
    if (kind === "quiz" && Array.isArray(j.questions) && j.questions.every((q: { q?: unknown; options?: unknown; answerIndex?: unknown }) => typeof q.q === "string" && Array.isArray(q.options) && typeof q.answerIndex === "number")) return { questions: j.questions.slice(0, 20) };
  } catch {}
  return null;
}

function Flashcards({ cards }: Cards) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const go = (d: number) => { setFlipped(false); setI((x) => Math.min(cards.length - 1, Math.max(0, x + d))); };
  return (
    <div>
      <button onClick={() => setFlipped((f) => !f)} aria-label="Flip card" className={cn("flex min-h-44 w-full flex-col items-center justify-center rounded-2xl border p-6 text-center transition-colors", flipped ? "border-accent bg-accent-soft" : "border-border bg-surface-2 hover:border-border-strong")}>
        <span className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-subtle">{flipped ? "Answer" : "Question"}</span>
        <span className="text-[15px] leading-relaxed">{flipped ? cards[i].back : cards[i].front}</span>
        <span className="mt-3 flex items-center gap-1 text-xs text-subtle"><RotateCw className="h-3 w-3" />Tap to flip</span>
      </button>
      <div className="mt-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => go(-1)} disabled={i === 0}><ChevronLeft className="h-4 w-4" />Prev</Button>
        <span className="text-xs tabular-nums text-muted">{i + 1} / {cards.length}</span>
        <Button variant="ghost" size="sm" onClick={() => go(1)} disabled={i === cards.length - 1}>Next<ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function QuizView({ questions }: Quiz) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const q = questions[i];
  const answered = picked[i] !== undefined;
  const score = Object.entries(picked).filter(([k, v]) => questions[Number(k)].answerIndex === v).length;
  return (
    <div>
      <p className="text-xs text-muted">Question {i + 1} of {questions.length} · Score {score}/{Object.keys(picked).length}</p>
      <p className="mt-2 font-medium">{q.q}</p>
      <div className="mt-3 space-y-2">
        {q.options.map((o, k) => {
          const correct = k === q.answerIndex, chosen = picked[i] === k;
          return (
            <button key={k} disabled={answered} onClick={() => setPicked({ ...picked, [i]: k })}
              className={cn("flex w-full items-center gap-2 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors", !answered && "hover:border-accent hover:bg-surface-2", answered && correct && "border-success bg-success/10", answered && chosen && !correct && "border-danger bg-danger/10", !answered && "border-border")}>
              <span className="flex-1">{o}</span>{answered && correct && <Check className="h-4 w-4 text-success" />}{answered && chosen && !correct && <X className="h-4 w-4 text-danger" />}
            </button>
          );
        })}
      </div>
      {answered && q.explanation && <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm text-muted">{q.explanation}</p>}
      <div className="mt-3 flex justify-between">
        <Button variant="ghost" size="sm" onClick={() => setI(i - 1)} disabled={i === 0}><ChevronLeft className="h-4 w-4" />Prev</Button>
        <Button variant="ghost" size="sm" onClick={() => setI(i + 1)} disabled={i === questions.length - 1}>Next<ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

export function StudySet({ kind, raw }: { kind: "flashcards" | "quiz"; raw: string }) {
  const set = parseStudySet(kind, raw);
  if (!set) return <p className="text-sm text-danger">This study set could not be read.</p>;
  return "cards" in set ? <Flashcards cards={set.cards} /> : <QuizView questions={set.questions} />;
}
