"use client";
import { useState } from "react";
import { Compass, Loader2, SearchX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CaseCard } from "./case-card";
import type { CaseCardView } from "@/server/services/dashboard";

/** Renders the first (server-fetched) page and appends further pages through cursor pagination. */
export function ExploreFeed({ initial, nextCursor, queryString, hasFilters }: { initial: CaseCardView[]; nextCursor: string | null; queryString: string; hasFilters: boolean }) {
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(nextCursor);
  const [loading, setLoading] = useState(false);

  async function more() {
    if (!cursor) return;
    setLoading(true);
    try {
      const sp = new URLSearchParams(queryString);
      sp.set("cursor", cursor);
      const res = await fetch(`/api/cases/feed?${sp}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { items: CaseCardView[]; nextCursor: string | null };
      setItems((p) => [...p, ...data.items]);
      setCursor(data.nextCursor);
    } catch {
      toast.error("Couldn't load more cases");
    } finally {
      setLoading(false);
    }
  }

  if (!items.length)
    return (
      <Card>
        <EmptyState
          icon={hasFilters ? SearchX : Compass}
          title={hasFilters ? "No cases match these filters" : "No cases have been published yet"}
          description={hasFilters ? "Try removing a filter or searching with different keywords." : "Verified members can upload a de-identified case to get things started."}
        />
      </Card>
    );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{items.map((c) => <CaseCard key={c.id} c={c} />)}</div>
      {cursor && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={more} disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}Load more</Button>
        </div>
      )}
    </div>
  );
}
