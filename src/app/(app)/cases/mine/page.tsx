import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen, Upload } from "lucide-react";
import { db } from "@/server/db";
import { requireOnboardedUser } from "@/server/dal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MODALITY_LABEL } from "@/lib/labels";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "My submissions" };

const STATUS = {
  DRAFT: { label: "Draft — finish submitting", tone: "neutral" }, PROCESSING: { label: "Processing", tone: "neutral" },
  PENDING_REVIEW: { label: "Awaiting moderator review", tone: "warning" }, PUBLISHED: { label: "Published", tone: "success" },
  REJECTED: { label: "Returned — needs changes", tone: "danger" }, REMOVED: { label: "Removed", tone: "danger" },
} as const;

export default async function MySubmissionsPage() {
  const user = await requireOnboardedUser();
  const cases = await db.case.findMany({ where: { authorId: user.id, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, title: true, modality: true, status: true, createdAt: true, rejectionReason: true } });
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-semibold tracking-tight">My submissions</h1><Button asChild><Link href="/cases/new"><Upload className="h-4 w-4" />New case</Link></Button></div>
      <Card className="divide-y divide-border">
        {cases.length === 0 ? <EmptyState icon={FolderOpen} title="No submissions yet" description="Cases you upload appear here with their review status." /> : cases.map((c) => {
          const s = STATUS[c.status];
          const href = c.status === "DRAFT" || c.status === "REJECTED" ? `/cases/${c.id}/review` : `/cases/${c.id}`;
          return (
            <Link key={c.id} href={href} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2">
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{c.title}</p><p className="text-xs text-muted">{MODALITY_LABEL[c.modality]} · {timeAgo(c.createdAt)}{c.status === "REJECTED" && c.rejectionReason ? ` · ${c.rejectionReason}` : ""}</p></div>
              <Badge tone={s.tone}>{s.label}</Badge>
            </Link>
          );
        })}
      </Card>
    </div>
  );
}
