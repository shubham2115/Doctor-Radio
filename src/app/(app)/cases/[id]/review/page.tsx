import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/server/db";
import { requireOnboardedUser } from "@/server/dal";
import { signedFileUrl } from "@/server/signing";
import { ReviewForm, type ReviewFile } from "@/components/cases/review-form";

export const metadata: Metadata = { title: "Review before submitting" };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireOnboardedUser();
  const { id } = await params;
  const c = await db.case.findUnique({
    where: { id },
    include: { files: { orderBy: { position: "asc" } }, deidReports: true },
  });
  if (!c || c.authorId !== user.id || c.deletedAt) notFound();
  if (c.status !== "DRAFT" && c.status !== "REJECTED") redirect(`/cases/${id}`);

  const files: ReviewFile[] = c.files.map((f) => {
    const report = c.deidReports.find((r) => r.fileId === f.id);
    return {
      id: f.id, kind: f.kind, name: f.originalName, thumbUrl: f.thumbKey ? signedFileUrl(f.id, "thumb") : null, scan: f.scanStatus,
      findings: (report?.findings as { name: string; action: string }[] | undefined) ?? [],
      burnedIn: report?.burnedInTextSuspected ?? false, frames: f.sliceCount,
    };
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-accent">Step 2 of 2</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{c.title}</h1>
        <p className="mt-1 text-sm text-muted">Review the processed files, then confirm privacy before submitting for moderator review.</p>
      </div>
      <ReviewForm caseId={c.id} files={files} rejection={c.status === "REJECTED" ? c.rejectionReason : null} />
    </div>
  );
}
