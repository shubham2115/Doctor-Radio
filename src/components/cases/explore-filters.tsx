"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BODY_REGIONS, CASE_CATEGORIES } from "@/lib/validation/case";
import { DIFFICULTY_LABEL, MODALITY_LABEL } from "@/lib/labels";

const SORTS = [["new", "Newest"], ["trending", "Trending"], ["awaiting", "Awaiting discussion"]] as const;
const DATES = [["7d", "Past week"], ["30d", "Past month"], ["90d", "Past 3 months"], ["365d", "Past year"]] as const;

export function ExploreFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");

  function apply(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    next.delete("cursor");
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    start(() => router.replace(`/explore?${next}`));
  }
  const activeCount = ["modality", "region", "difficulty", "category", "date"].filter((k) => sp.get(k)).length;

  const sel = (key: string, label: string, options: readonly (readonly [string, string])[]) => (
    <Select aria-label={label} value={sp.get(key) ?? ""} onChange={(e) => apply({ [key]: e.target.value || null })} className="h-9 w-auto min-w-36 text-[13px]">
      <option value="">{label}</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </Select>
  );

  return (
    <div className={`space-y-3 transition-opacity ${pending ? "opacity-70" : ""}`}>
      <form onSubmit={(e) => { e.preventDefault(); apply({ q: q.trim() || null }); }} role="search" className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <input
          value={q} onChange={(e) => setQ(e.target.value)} maxLength={200}
          placeholder="Search by findings, history, tags… e.g. “MRI brain ring-enhancing lesions”"
          className="h-12 w-full rounded-xl border border-border bg-surface pl-10 pr-24 text-sm placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
        />
        <Button type="submit" size="sm" className="absolute right-2 top-1/2 -translate-y-1/2">Search</Button>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        {sel("modality", "Modality", Object.entries(MODALITY_LABEL))}
        {sel("region", "Body region", BODY_REGIONS.map((r) => [r, r] as const))}
        {sel("difficulty", "Difficulty", Object.entries(DIFFICULTY_LABEL))}
        {sel("category", "Category", CASE_CATEGORIES.map((r) => [r, r] as const))}
        {sel("date", "Any date", DATES)}
        <div className="ml-auto flex items-center gap-2">
          {(activeCount > 0 || sp.get("q")) && (
            <Button variant="ghost" size="sm" onClick={() => { setQ(""); start(() => router.replace(`/explore?sort=${sp.get("sort") ?? "new"}`)); }}><X className="h-3.5 w-3.5" />Clear</Button>
          )}
          <Select aria-label="Sort" value={sp.get("sort") ?? "new"} onChange={(e) => apply({ sort: e.target.value })} className="h-9 w-auto min-w-40 text-[13px]">
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>
      </div>
    </div>
  );
}
