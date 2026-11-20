import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, MessagesSquare, ScanEye } from "lucide-react";
import { db } from "@/server/db";
import { requireOnboardedUser } from "@/server/dal";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MODALITY_LABEL } from "@/lib/labels";
import { cn, timeAgo } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

export const metadata: Metadata = { title: "Discussions" };

const VIEWS = [["active", "Active"], ["awaiting", "Awaiting first read"], ["mine", "I'm part of"]] as const;
const PAGE = 15;

export default async function DiscussionsPage({ searchParams }: { searchParams: Promise<{ view?: string; cursor?: string }> }) {
  const user = await requireOnboardedUser();
  const sp = await searchParams;
  const view = VIEWS.some(([v]) => v === sp.view) ? sp.view! : "active";

  const where: Prisma.CaseWhereInput = { status: "PUBLISHED", deletedAt: null };
  if (view === "active") where.OR = [{ commentCount: { gt: 0 } }, { observationCount: { gt: 0 } }];
  if (view === "awaiting") where.observationCount = 0;
  if (view === "mine") where.OR = [{ observations: { some: { authorId: user.id, deletedAt: null } } }, { comments: { some: { authorId: user.id, deletedAt: null } } }];

  const rows = await db.case.findMany({
    where, orderBy: [{ lastActivityAt: "desc" }, { id: "asc" }], take: PAGE + 1,
    ...(sp.cursor ? { cursor: { id: sp.cursor }, skip: 1 } : {}),
    select: {
      id: true, title: true, modality: true, bodyRegion: true, lastActivityAt: true, commentCount: true, observationCount: true,
      author: { select: { profile: { select: { displayName: true, avatarUrl: true } } } },
      comments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 1, select: { body: true, author: { select: { profile: { select: { displayName: true } } } } } },
    },
  });
  const more = rows.length > PAGE;
  const items = rows.slice(0, PAGE);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div><h1 className="text-2xl font-semibold tracking-tight">Discussions</h1><p className="mt-1 text-sm text-muted">Cases where the community is comparing reads and talking it through.</p></div>
      <div className="flex gap-1 rounded-xl bg-surface-2 p-1" role="tablist">
        {VIEWS.map(([v, label]) => (
          <Link key={v} href={`/discussions?view=${v}`} role="tab" aria-selected={view === v} className={cn("flex-1 rounded-lg px-3 py-1.5 text-center text-sm font-medium transition-colors", view === v ? "bg-surface shadow-[var(--shadow-sm)]" : "text-muted hover:text-fg")}>{label}</Link>
        ))}
      </div>
      <Card className="divide-y divide-border overflow-hidden">
        {items.length === 0 ? (
          <EmptyState icon={MessagesSquare} title={view === "mine" ? "You haven't joined a discussion yet" : view === "awaiting" ? "Every case has a first read" : "No discussions yet"} description={view === "mine" ? "Write an observation or comment on a case and it will appear here." : "Observations and comments on published cases show up here."} action={<Button asChild size="sm"><Link href="/explore">Explore cases</Link></Button>} />
        ) : items.map((c) => {
          const last = c.comments[0];
          return (
            <Link key={c.id} href={`/cases/${c.id}`} className="flex gap-3.5 px-5 py-4 transition-colors hover:bg-surface-2">
              <Avatar name={c.author.profile?.displayName} src={c.author.profile?.avatarUrl} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><p className="truncate font-medium">{c.title}</p><Badge tone="accent" className="shrink-0">{MODALITY_LABEL[c.modality]}</Badge></div>
                {last ? <p className="mt-0.5 line-clamp-1 text-sm text-muted"><span className="font-medium text-fg">{last.author.profile?.displayName}:</span> {last.body.replace(/[*_`>#\[\]]/g, "")}</p> : <p className="mt-0.5 text-sm text-muted">{c.bodyRegion} · be the first to share a read</p>}
                <p className="mt-1.5 flex items-center gap-3 text-xs text-subtle"><span className="flex items-center gap-1"><ScanEye className="h-3.5 w-3.5" />{c.observationCount}</span><span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{c.commentCount}</span><span>active {timeAgo(c.lastActivityAt)}</span></p>
              </div>
            </Link>
          );
        })}
      </Card>
      {more && <div className="flex justify-center"><Button asChild variant="secondary"><Link href={`/discussions?view=${view}&cursor=${items[items.length - 1].id}`}>Older discussions</Link></Button></div>}
    </div>
  );
}
