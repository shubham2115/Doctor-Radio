import Link from "next/link";
import { Bookmark, Flame, MessagesSquare, PenLine, Sparkles, Upload, Users } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { CaseCard } from "@/components/cases/case-card";
import { MODALITY_LABEL } from "@/lib/labels";
import { DESIGNATIONS } from "@/lib/validation/profile";
import { timeAgo } from "@/lib/utils";
import * as q from "@/server/services/dashboard";
import { toCardView } from "@/server/services/dashboard";

function Section({ title, icon: Icon, href, children }: { title: string; icon: React.ElementType; href?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight"><Icon className="h-4 w-4 text-accent" />{title}</h2>
        {href && <Link href={href} className="text-sm text-muted hover:text-accent">View all</Link>}
      </div>
      {children}
    </section>
  );
}

function CaseGrid({ cases, empty }: { cases: q.CaseCardData[]; empty: React.ReactNode }) {
  if (!cases.length) return <Card>{empty}</Card>;
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cases.map((c) => <CaseCard key={c.id} c={toCardView(c)} />)}</div>;
}

export function CaseGridSkeleton({ n = 4 }: { n?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: n }).map((_, i) => (
        <Card key={i} className="overflow-hidden"><Skeleton className="aspect-[16/9] rounded-none" /><div className="space-y-2 p-4"><Skeleton className="h-3 w-1/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div></Card>
      ))}
    </div>
  );
}

const noCases = (title: string, description: string, withUpload = true) => (
  <EmptyState icon={Sparkles} title={title} description={description}
    action={withUpload ? <Button asChild size="sm"><Link href="/cases/new"><Upload className="h-4 w-4" />Upload a case</Link></Button> : undefined} />
);

export async function TrendingSection() {
  const cases = await q.trendingCases();
  return <Section title="Trending cases" icon={Flame} href="/explore?sort=trending"><CaseGrid cases={cases} empty={noCases("Nothing trending yet", "Cases gain traction as the community discusses them.")} /></Section>;
}

export async function RecentSection() {
  const cases = await q.recentCases(8);
  return <Section title="Recently uploaded" icon={Upload} href="/explore"><CaseGrid cases={cases} empty={noCases("No cases published yet", "Be the first to share a de-identified case with the community.")} /></Section>;
}

export async function AwaitingSection() {
  const cases = await q.awaitingDiscussion();
  return <Section title="Awaiting discussion" icon={MessagesSquare} href="/explore?filter=awaiting"><CaseGrid cases={cases} empty={noCases("Every case has a conversation", "Cases with no observations yet will show up here.", false)} /></Section>;
}

export async function RecommendedSection({ userId }: { userId: string }) {
  const cases = await q.recommendedCases(userId);
  return <Section title="Recommended for you" icon={Sparkles}><CaseGrid cases={cases} empty={noCases("Recommendations will appear here", "Once cases are published, you'll see ones you haven't read yet.", false)} /></Section>;
}

export async function SavedSection({ userId }: { userId: string }) {
  const cases = await q.savedCases(userId);
  return <Section title="My saved cases" icon={Bookmark}><CaseGrid cases={cases} empty={<EmptyState icon={Bookmark} title="Nothing saved yet" description="Bookmark cases to build your personal study list." />} /></Section>;
}

export async function ContributorsCard() {
  const people = await q.activeContributors();
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><Users className="h-4 w-4 text-accent" />Top contributors</span>} action={<Link href="/leaderboard" className="text-sm text-muted hover:text-accent">All</Link>} />
      <div className="p-2 pt-3">
        {people.length === 0 ? (
          <EmptyState icon={Users} title="No contributors yet" description="Helpful observations and cases earn points." />
        ) : (
          people.map((p, i) => (
            <Link key={p.username} href={`/u/${p.username}`} className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-surface-2">
              <span className="w-4 text-center text-xs font-semibold text-subtle">{i + 1}</span>
              <Avatar name={p.displayName} src={p.avatarUrl} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{p.displayName}</span>
                <span className="block truncate text-xs text-muted">{DESIGNATIONS.find((d) => d.value === p.designation)?.label}</span>
              </span>
              <span className="text-sm font-semibold tabular-nums text-accent">{p.points}</span>
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}

export async function MyObservationsCard({ userId }: { userId: string }) {
  const rows = await q.myRecentObservations(userId);
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><PenLine className="h-4 w-4 text-accent" />My recent observations</span>} />
      <div className="p-2 pt-3">
        {rows.length === 0 ? (
          <EmptyState icon={PenLine} title="No observations yet" description="Open a case and write your independent read." />
        ) : (
          rows.map((o) => (
            <Link key={o.id} href={`/cases/${o.case.id}`} className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-2">
              <span className="flex items-center justify-between text-xs text-muted"><span>{MODALITY_LABEL[o.case.modality]}</span><span>{timeAgo(o.createdAt)}</span></span>
              <span className="mt-0.5 block truncate text-sm font-medium">{o.case.title}</span>
              <span className="line-clamp-1 text-xs text-muted">{o.impression ?? o.findings}</span>
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}

export function SideSkeleton() {
  return <Card className="space-y-3 p-5"><Skeleton className="h-4 w-1/2" />{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</Card>;
}
