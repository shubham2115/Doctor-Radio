import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, BadgeCheck, ShieldAlert, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireOnboardedUser } from "@/server/dal";
import {
  AwaitingSection, CaseGridSkeleton, ContributorsCard, MyObservationsCard, RecentSection,
  RecommendedSection, SavedSection, SideSkeleton, TrendingSection,
} from "@/components/home/sections";

export const metadata: Metadata = { title: "Home" };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function HomePage() {
  const user = await requireOnboardedUser();
  const first = user.profile.displayName.replace(/^dr\.?\s+/i, "").split(" ")[0];
  const status = user.profile.verificationStatus;

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-[20px] bg-navy p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-accent/25 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-white/60">{greeting()},</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Dr. {first}</h1>
            <p className="mt-2 max-w-md text-sm text-white/70">Read a case independently, compare your thinking with the community, and keep your streak going.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild><Link href="/explore">Explore cases <ArrowRight className="h-4 w-4" /></Link></Button>
            <Button asChild variant="secondary" className="border-white/15 bg-white/10 text-white hover:bg-white/20"><Link href="/cases/new"><Upload className="h-4 w-4" />Upload case</Link></Button>
          </div>
        </div>
      </section>

      {status !== "VERIFIED" && (
        <Link href="/profile#verification" className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm transition-colors hover:bg-warning/15">
          {status === "PENDING" ? <BadgeCheck className="h-5 w-5 shrink-0 text-warning" /> : <ShieldAlert className="h-5 w-5 shrink-0 text-warning" />}
          <span className="flex-1">
            {status === "PENDING"
              ? <>Your professional verification is <strong>under review</strong>. You can read and discuss cases meanwhile.</>
              : <><strong>Verify your professional credentials</strong> to upload cases and earn the verified badge.</>}
          </span>
          {status !== "PENDING" && <ArrowRight className="h-4 w-4 shrink-0" />}
        </Link>
      )}

      <Suspense fallback={<CaseGridSkeleton />}><TrendingSection /></Suspense>

      <div className="grid gap-8 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-10">
          <Suspense fallback={<CaseGridSkeleton />}><RecentSection /></Suspense>
          <Suspense fallback={<CaseGridSkeleton />}><AwaitingSection /></Suspense>
          <Suspense fallback={<CaseGridSkeleton />}><RecommendedSection userId={user.id} /></Suspense>
          <Suspense fallback={<CaseGridSkeleton />}><SavedSection userId={user.id} /></Suspense>
        </div>
        <aside className="space-y-6">
          <Suspense fallback={<SideSkeleton />}><ContributorsCard /></Suspense>
          <Suspense fallback={<SideSkeleton />}><MyObservationsCard userId={user.id} /></Suspense>
        </aside>
      </div>
    </div>
  );
}
