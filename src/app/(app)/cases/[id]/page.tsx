import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { db } from "@/server/db";
import { requireOnboardedUser } from "@/server/dal";
import { getCaseDetail } from "@/server/services/case-detail";
import { llmConfigured } from "@/server/llm/providers";
import { Viewer } from "@/components/cases/viewer";
import { CasePanel } from "@/components/cases/case-panel";
import { ModerationBar } from "@/components/cases/moderation-bar";

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<{ tab?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await db.case.findUnique({ where: { id: (await params).id }, select: { title: true, status: true } });
  return { title: c?.status === "PUBLISHED" ? c.title : "Case" };
}

export default async function CasePage({ params, searchParams }: Props) {
  const user = await requireOnboardedUser();
  const { id } = await params;
  const tabParam = (await searchParams)?.tab;
  const initialTab = (["observations", "discussion", "ai"] as const).find((t) => t === tabParam);
  const d = await getCaseDetail(id, { id: user.id, role: user.role });
  if (!d) notFound();
  if (d.status === "DRAFT" || d.status === "REJECTED") redirect(d.viewer.isAuthor ? `/cases/${id}/review` : "/explore");

  // Count a view once per page load of a published case (cheap, best-effort).
  if (d.status === "PUBLISHED" && !d.viewer.isAuthor) db.case.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/explore" className="flex items-center gap-1.5 text-sm text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" />Back to cases</Link>
      </div>
      {d.status === "PENDING_REVIEW" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm"><Clock className="h-4 w-4 text-warning" />This case is awaiting moderator review and is not yet visible to the community.</div>
          {d.viewer.isStaff && <ModerationBar caseId={d.id} />}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]"><Viewer items={d.files} /></div>
        <CasePanel d={d} aiConfigured={await llmConfigured()} initialTab={initialTab} />
      </div>
    </div>
  );
}
