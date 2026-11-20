import type { Metadata } from "next";
import { Suspense } from "react";
import { requireOnboardedUser } from "@/server/dal";
import { exploreQuerySchema, searchCases } from "@/server/services/explore";
import { ExploreFilters } from "@/components/cases/explore-filters";
import { ExploreFeed } from "@/components/cases/explore-feed";
import { CaseGridSkeleton } from "@/components/home/sections";

export const metadata: Metadata = { title: "Explore cases" };

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireOnboardedUser();
  const raw = await searchParams;
  // Legacy dashboard link used ?filter=awaiting
  if (raw.filter === "awaiting") raw.sort = "awaiting";
  const parsed = exploreQuerySchema.safeParse(raw);
  const query = parsed.success ? parsed.data : exploreQuerySchema.parse({});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Explore cases</h1>
        <p className="mt-1 text-sm text-muted">Search the community library and find your next case to study.</p>
      </div>
      <Suspense><ExploreFilters /></Suspense>
      <Suspense key={JSON.stringify(query)} fallback={<CaseGridSkeleton n={8} />}>
        <Results query={query} />
      </Suspense>
    </div>
  );
}

async function Results({ query }: { query: ReturnType<typeof exploreQuerySchema.parse> }) {
  const { items, nextCursor } = await searchCases(query);
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v && k !== "cursor") sp.set(k, String(v));
  const hasFilters = Boolean(query.q || query.modality || query.region || query.difficulty || query.category || query.date || query.sort === "awaiting");
  return <ExploreFeed key={sp.toString()} initial={items} nextCursor={nextCursor} queryString={sp.toString()} hasFilters={hasFilters} />;
}
