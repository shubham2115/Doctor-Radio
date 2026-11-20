import type { Metadata } from "next";
import Link from "next/link";
import { Award, BookOpen, Brain, Flame, ListChecks, ThumbsUp, Trophy } from "lucide-react";
import { db } from "@/server/db";
import { requireOnboardedUser } from "@/server/dal";
import { llmConfigured } from "@/server/llm/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StudySet } from "@/components/learning/study-set";
import { MODALITY_LABEL } from "@/lib/labels";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Learning" };

export default async function LearningPage() {
  const user = await requireOnboardedUser();
  const [sets, studyCases, helpful, achievements] = await Promise.all([
    db.aIMessage.findMany({
      where: { role: "ASSISTANT", task: { in: ["flashcards", "quiz"] }, conversation: { userId: user.id } },
      orderBy: { createdAt: "desc" }, take: 10,
      select: { id: true, task: true, content: true, createdAt: true, conversation: { select: { case: { select: { id: true, title: true } } } } },
    }),
    // Study list: cases you saved, plus cases you've read, newest first.
    db.case.findMany({
      where: { status: "PUBLISHED", deletedAt: null, OR: [{ bookmarks: { some: { userId: user.id } } }, { observations: { some: { authorId: user.id, deletedAt: null } } }] },
      orderBy: { lastActivityAt: "desc" }, take: 8, select: { id: true, title: true, modality: true, bodyRegion: true },
    }),
    db.observationHelpful.count({ where: { observation: { authorId: user.id } } }),
    db.userAchievement.findMany({ where: { userId: user.id }, include: { achievement: true }, orderBy: { awardedAt: "desc" } }),
  ]);
  const p = user.profile;
  const stats = [
    { icon: Flame, label: "Day streak", value: p.streakDays }, { icon: Trophy, label: "Points", value: p.points },
    { icon: ThumbsUp, label: "Helpful marks", value: helpful }, { icon: Award, label: "Badges", value: achievements.length },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight">Learning</h1><p className="mt-1 text-sm text-muted">Turn the cases you study into flashcards and quizzes with the AI study assistant.</p></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ icon: Icon, label, value }) => <Card key={label} className="p-4"><Icon className="h-4 w-4 text-accent" /><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p><p className="text-xs text-muted">{label}</p></Card>)}
      </div>
      {!(await llmConfigured()) && <p className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">AI study tools are not configured yet. An administrator can add an API key under Moderation → AI settings.</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Make a study set" />
          <div className="p-2 pt-3">
            {studyCases.length === 0 ? <EmptyState icon={BookOpen} title="Nothing to study yet" description="Save a case or write an observation, then generate flashcards and quizzes from it." action={<Button asChild size="sm"><Link href="/explore">Explore cases</Link></Button>} /> : studyCases.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2">
                <div className="min-w-0 flex-1"><Link href={`/cases/${c.id}`} className="block truncate text-sm font-medium hover:text-accent">{c.title}</Link><p className="text-xs text-muted">{MODALITY_LABEL[c.modality]} · {c.bodyRegion}</p></div>
                <Button asChild size="sm" variant="secondary"><Link href={`/cases/${c.id}?tab=ai`}><ListChecks className="h-3.5 w-3.5" />Cards</Link></Button>
                <Button asChild size="sm" variant="secondary"><Link href={`/cases/${c.id}?tab=ai`}><Brain className="h-3.5 w-3.5" />Quiz</Link></Button>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Badges" />
          <div className="flex flex-wrap gap-2 p-5 pt-3">
            {achievements.length === 0 ? <p className="text-sm text-muted">Earn badges by writing observations, getting helpful marks, keeping a streak, and contributing cases.</p> : achievements.map(({ achievement: a }) => <Badge key={a.id} tone="accent" title={a.description}><Award className="h-3.5 w-3.5" />{a.name}</Badge>)}
          </div>
        </Card>
      </div>

      <section>
        <h2 className="mb-3 text-base font-semibold tracking-tight">My saved study sets</h2>
        {sets.length === 0 ? <Card><EmptyState icon={ListChecks} title="No study sets yet" description="Open a case, switch to the AI assistant tab and choose Flashcards or Quiz me. They're saved here." /></Card> : (
          <div className="space-y-3">
            {sets.map((s) => (
              <Card key={s.id} className="p-5">
                <details>
                  <summary className="flex cursor-pointer list-none items-center gap-3">
                    <Badge tone="accent">{s.task === "quiz" ? "Quiz" : "Flashcards"}</Badge>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.conversation.case?.title ?? "Case removed"}</span>
                    <span className="text-xs text-subtle">{timeAgo(s.createdAt)}</span>
                  </summary>
                  <div className="mt-4"><StudySet kind={s.task as "quiz" | "flashcards"} raw={s.content} /><p className="mt-3 text-[11px] italic text-subtle">AI-generated study material — verify against references.</p></div>
                </details>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
