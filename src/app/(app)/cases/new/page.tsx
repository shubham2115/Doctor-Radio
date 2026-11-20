import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { requireOnboardedUser } from "@/server/dal";
import { UploadForm } from "@/components/cases/upload-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Upload case" };

export default async function UploadCasePage() {
  const user = await requireOnboardedUser();
  const allowed = user.role !== "MEMBER" || user.profile.verificationStatus === "VERIFIED";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Upload a case</h1>
          <p className="mt-1 text-sm text-muted">Share a de-identified case. It goes live only after your confirmation and a moderator&apos;s review.</p>
        </div>
        <Button asChild variant="secondary"><Link href="/cases/mine">My submissions</Link></Button>
      </div>
      {allowed ? (
        <UploadForm />
      ) : (
        <Card className="mx-auto max-w-xl p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/10 text-warning"><ShieldAlert className="h-6 w-6" /></span>
          <h2 className="mt-4 text-lg font-semibold">Verification required</h2>
          <p className="mt-2 text-sm text-muted">
            {user.profile.verificationStatus === "PENDING"
              ? "Your credentials are under review. You'll be able to upload as soon as a moderator approves them."
              : "To protect patients and the community, only verified doctors can upload cases. Submit your medical registration for review."}
          </p>
          {user.profile.verificationStatus !== "PENDING" && <Button asChild className="mt-5"><Link href="/profile#verification">Verify my credentials</Link></Button>}
        </Card>
      )}
    </div>
  );
}
