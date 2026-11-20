import type { Metadata } from "next";
import Link from "next/link";
import { Flame, Medal, MessagesSquare, ThumbsUp, Trophy } from "lucide-react";
import { db } from "@/server/db";
import { requireOnboardedUser } from "@/server/dal";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MODALITY_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Leaderboard" };

const TABS = [["week", "This week", Trophy], ["all", "All time", Medal], ["helpful", "Most helpful", ThumbsUp], ["streak", "Streaks", Flame], ["cases", "Most discussed", MessagesSquare]] as const;
type Row = { username: string; name: string; avatar: string | null; value: number; unit: string };

async function load(tab: string): Promise<Row[]> {
  const people = (rows: { username: string; displayName: string; avatarUrl: string | null }[], values: number[], unit: string): Row[] =>
    rows.map((r, i) => ({ username: r.username, name: r.displayName, avatar: r.avatarUrl, value: values[i], unit }));

  if (tab === "all" || tab === "streak") {
    const key = tab === "all" ? "points" : "streakDays";
    const rows = await db.userProfile.findMany({ where: { [key]: { gt: 0 }, user: { status: "ACTIVE" } }, orderBy: { [key]: "desc" }, take: 20, select: { username: true, displayName: true, avatarUrl: true, points: true, streakDays: true } });
    return people(rows, rows.map((r) => (tab === "all" ? r.points : r.streakDays)), tab === "all" ? "pts" : "days");
  }
  const rawRows =
    tab === "week"
      ? await db.$queryRaw<{ userId: string; v: bigint }[]>`SELECT "userId", SUM(points) AS v FROM "PointEvent" WHERE "createdAt" >= now() - interval '7 days' GROUP BY "userId" HAVING SUM(points) > 0 ORDER BY v DESC LIMIT 20`
      : tab === "helpful"
        ? await db.$queryRaw<{ userId: string; v: bigint }[]>`SELECT o."authorId" AS "userId", COUNT(*) AS v FROM "ObservationHelpful" h JOIN "Observation" o ON o.id = h."observationId" WHERE o."deletedAt" IS NULL GROUP BY o."authorId" ORDER BY v DESC LIMIT 20`
        : [];
  if (!rawRows.length) return [];
  const profiles = await db.userProfile.findMany({ where: { userId: { in: rawRows.map((r) => r.userId) }, user: { status: "ACTIVE" } }, select: { userId: true, username: true, displayName: true, avatarUrl: true } });
  const byId = new Map(profiles.map((p) => [p.userId, p]));
  return rawRows.flatMap((r) => { const p = byId.get(r.userId); return p ? [{ username: p.username, name: p.displayName, avatar: p.avatarUrl, value: Number(r.v), unit: tab === "week" ? "pts" : "helpful" }] : []; });
}

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireOnboardedUser();
  const requested = (await searchParams).tab;
  const tab = TABS.some(([t]) => t === requested) ? requested! : "week";

  const cases = tab === "cases" ? await db.case.findMany({ where: { status: "PUBLISHED", deletedAt: null, OR: [{ commentCount: { gt: 0 } }, { observationCount: { gt: 0 } }] }, orderBy: [{ commentCount: "desc" }, { observationCount: "desc" }], take: 15, select: { id: true, title: true, modality: true, commentCount: true, observationCount: true } }) : [];
  const rows = tab === "cases" ? [] : await load(tab);
  const myIdx = rows.findIndex((r) => r.username === user.profile.username);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div><h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1><p className="mt-1 text-sm text-muted">Recognition for thoughtful contributions. Points come from published cases, observations (capped daily) and peer-rated helpfulness — never from being &quot;right&quot; or posting the most.</p></div>
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1" role="tablist">
        {TABS.map(([t, label, Icon]) => (
          <Link key={t} href={`/leaderboard?tab=${t}`} role="tab" aria-selected={tab === t} className={cn("flex shrink-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors", tab === t ? "bg-surface shadow-[var(--shadow-sm)]" : "text-muted hover:text-fg")}><Icon className="h-3.5 w-3.5" />{label}</Link>
        ))}
      </div>
      <Card className="divide-y divide-border overflow-hidden">
        {tab === "cases" ? (
          cases.length === 0 ? <EmptyState icon={MessagesSquare} title="No discussed cases yet" description="Cases with observations and comments will rank here." /> : cases.map((c, i) => (
            <Link key={c.id} href={`/cases/${c.id}`} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-2">
              <span className="w-6 text-center text-sm font-semibold text-subtle">{i + 1}</span>
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{c.title}</p><p className="text-xs text-muted">{MODALITY_LABEL[c.modality]}</p></div>
              <span className="text-right text-xs text-muted"><b className="text-sm text-fg">{c.commentCount}</b> comments<br /><b className="text-sm text-fg">{c.observationCount}</b> reads</span>
            </Link>
          ))
        ) : rows.length === 0 ? <EmptyState icon={Trophy} title="No one on the board yet" description="Write an observation or get a case published to earn the first points." /> : rows.map((r, i) => (
          <Link key={r.username} href={`/u/${r.username}`} className={cn("flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-2", r.username === user.profile.username && "bg-accent-soft")}>
            <span className={cn("w-6 text-center text-sm font-semibold", i < 3 ? "text-accent" : "text-subtle")}>{i + 1}</span>
            <Avatar name={r.name} src={r.avatar} size={36} />
            <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
            <span className="text-sm"><b className="tabular-nums text-accent">{r.value}</b> <span className="text-xs text-muted">{r.unit}</span></span>
          </Link>
        ))}
      </Card>
      {tab !== "cases" && rows.length > 0 && myIdx === -1 && <p className="text-center text-sm text-muted">You&apos;re not on this board yet — write an observation to get started.</p>}
    </div>
  );
}
