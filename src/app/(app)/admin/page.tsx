import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Bot, FileSearch, Flag, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/server/db";
import { requireRole } from "@/server/dal";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ReportActions, VerificationActions } from "@/components/admin/admin-actions";
import { MODALITY_LABEL } from "@/lib/labels";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Moderation" };

export default async function AdminPage() {
  const me = await requireRole("MODERATOR");
  const [users, verified, cases, observations, comments, pendingCases, verifications, reports, audit] = await Promise.all([
    db.user.count(), db.userProfile.count({ where: { verificationStatus: "VERIFIED" } }),
    db.case.count({ where: { status: "PUBLISHED" } }), db.observation.count({ where: { deletedAt: null } }), db.comment.count({ where: { deletedAt: null } }),
    db.case.findMany({ where: { status: "PENDING_REVIEW", deletedAt: null }, orderBy: { updatedAt: "asc" }, take: 30, select: { id: true, title: true, modality: true, updatedAt: true, author: { select: { profile: { select: { displayName: true } } } }, _count: { select: { files: true } } } }),
    db.verificationRequest.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 30, include: { user: { select: { email: true, profile: { select: { displayName: true, designation: true, institution: { select: { name: true } } } } } } } }),
    db.report.findMany({ where: { status: { in: ["OPEN", "REVIEWING"] } }, orderBy: { createdAt: "asc" }, take: 30, include: { reporter: { select: { profile: { select: { displayName: true } } } } } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 12, include: { actor: { select: { profile: { select: { displayName: true } } } } } }),
  ]);
  const stats = [["Members", users], ["Verified doctors", verified], ["Published cases", cases], ["Observations", observations], ["Comments", comments]] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><ShieldCheck className="h-5 w-5" /></span>
        <div className="flex-1"><h1 className="text-2xl font-semibold tracking-tight">Moderation</h1><p className="text-sm text-muted">Review cases, verify doctors and handle reports.</p></div>
        {me.role === "ADMIN" && <Button asChild variant="secondary"><Link href="/admin/ai"><Bot className="h-4 w-4" />AI settings</Link></Button>}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{stats.map(([l, v]) => <Card key={l} className="p-4"><p className="text-2xl font-semibold tabular-nums">{v}</p><p className="text-xs text-muted">{l}</p></Card>)}</div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><FileSearch className="h-4 w-4 text-accent" />Cases awaiting review <Badge>{pendingCases.length}</Badge></span>} />
          <div className="p-2 pt-3">{pendingCases.length === 0 ? <EmptyState icon={FileSearch} title="Queue is clear" description="Submitted cases appear here for approval." /> : pendingCases.map((c) => (
            <Link key={c.id} href={`/cases/${c.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2">
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{c.title}</p><p className="text-xs text-muted">{MODALITY_LABEL[c.modality]} · {c._count.files} files · {c.author.profile?.displayName} · {timeAgo(c.updatedAt)}</p></div><span className="text-xs font-medium text-accent">Review →</span>
            </Link>))}</div>
        </Card>
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-accent" />Verification requests <Badge>{verifications.length}</Badge></span>} />
          <div className="p-2 pt-3">{verifications.length === 0 ? <EmptyState icon={BadgeCheck} title="No pending requests" description="Doctors submit their registration for verification from their profile." /> : verifications.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2">
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{v.user.profile?.displayName ?? v.user.email}</p><p className="text-xs text-muted">{v.council} · Reg. {v.registrationNo} · {v.user.profile?.institution?.name ?? "no institution"}</p></div>
              <VerificationActions id={v.id} />
            </div>))}</div>
        </Card>
      </div>

      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><Flag className="h-4 w-4 text-accent" />Open reports <Badge>{reports.length}</Badge></span>} />
        <div className="p-2 pt-3">{reports.length === 0 ? <EmptyState icon={Flag} title="No open reports" description="Reported cases, observations and comments land here." /> : reports.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2">
            <div className="min-w-0 flex-1"><p className="text-sm font-medium"><Badge tone={r.reason.startsWith("Patient") ? "danger" : "warning"}>{r.targetType.toLowerCase()}</Badge> <span className="ml-1">{r.reason}</span></p><p className="mt-0.5 text-xs text-muted">by {r.reporter.profile?.displayName} · {timeAgo(r.createdAt)}{r.details ? ` · “${r.details}”` : ""}</p></div>
            <ReportActions id={r.id} />
          </div>))}</div>
      </Card>

      <Card>
        <CardHeader title="Recent audit log" />
        <ul className="divide-y divide-border p-2 pt-3 text-sm">{audit.map((a) => <li key={a.id} className="flex gap-3 px-3 py-2"><code className="text-xs text-accent">{a.action}</code><span className="flex-1 truncate text-muted">{a.actor?.profile?.displayName ?? "system"}</span><span className="text-xs text-subtle">{timeAgo(a.createdAt)}</span></li>)}</ul>
      </Card>
    </div>
  );
}
