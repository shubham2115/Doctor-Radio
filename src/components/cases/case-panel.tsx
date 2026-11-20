"use client";
import { useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { TimeAgo } from "@/components/ui/time-ago";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/ui/markdown";
import { CaseActions } from "./case-actions";
import { CommentThread } from "./discussion";
import { ObservationsPanel, RevealGate } from "./observations";
import { AiPanel } from "./ai-panel";
import { DIFFICULTY_LABEL, DIFFICULTY_TONE, MODALITY_LABEL } from "@/lib/labels";
import { DESIGNATIONS } from "@/lib/validation/profile";
import { cn } from "@/lib/utils";
import type { CaseDetail } from "@/server/services/case-detail";

type Tab = "details" | "observations" | "discussion" | "ai";

export function CasePanel({ d, aiConfigured, initialTab = "details" }: { d: CaseDetail; aiConfigured: boolean; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [seed, setSeed] = useState<string | undefined>();
  const published = d.status === "PUBLISHED";
  const canInteract = published;
  const desig = DESIGNATIONS.find((x) => x.value === d.author.designation)?.label;

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "details", label: "Case" },
    { id: "observations", label: "Observations", badge: d.counts.observations },
    { id: "discussion", label: "Discussion", badge: d.counts.comments },
    { id: "ai", label: "AI assistant" },
  ];

  return (
    <div className="flex min-w-0 flex-col">
      <div role="tablist" className="sticky top-16 z-10 -mx-1 mb-4 flex gap-1 overflow-x-auto bg-bg/90 px-1 py-1 backdrop-blur">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors", tab === t.id ? "bg-surface text-fg shadow-[var(--shadow-sm)] ring-1 ring-border" : "text-muted hover:text-fg")}>
            {t.label}{t.badge ? <span className="rounded-full bg-surface-2 px-1.5 text-[11px] tabular-nums text-muted">{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {tab === "details" && (
        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">{MODALITY_LABEL[d.modality]}</Badge><Badge>{d.bodyRegion}</Badge>
              <Badge tone={DIFFICULTY_TONE[d.difficulty]}>{DIFFICULTY_LABEL[d.difficulty]}</Badge>
              {d.category && <Badge>{d.category}</Badge>}{d.ageRange && <Badge>{d.ageRange}</Badge>}
            </div>
            <h1 className="mt-3 text-2xl font-semibold leading-tight tracking-tight">{d.title}</h1>
            <div className="mt-3 flex items-center gap-2.5 text-sm text-muted">
              <Avatar name={d.author.name} src={d.author.avatar} size={28} />
              <span>{d.author.username ? <Link href={`/u/${d.author.username}`} className="font-medium text-fg hover:text-accent">{d.author.name}</Link> : d.author.name}{desig ? ` · ${desig}` : ""}{d.publishedAt ? <> · <TimeAgo date={d.publishedAt} /></> : null}</span>
            </div>
          </div>
          <CaseActions caseId={d.id} liked={d.viewer.liked} bookmarked={d.viewer.bookmarked} likes={d.counts.likes} canInteract={canInteract} />
          <section><h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-subtle">Clinical history</h2><Markdown>{d.clinicalHistory}</Markdown></section>
          {d.clinicalInfo && <section><h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-subtle">Relevant clinical information</h2><Markdown>{d.clinicalInfo}</Markdown></section>}
          {d.imagingFindings && <section><h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-subtle">Imaging findings (author)</h2><Markdown>{d.imagingFindings}</Markdown></section>}
          {d.finalDiagnosis && <section className="rounded-xl bg-surface-2 p-3 text-sm"><p className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Final diagnosis (visible to you as author / moderator)</p><p className="mt-1">{d.finalDiagnosis}</p></section>}
          {d.tags.length > 0 && <div className="flex flex-wrap gap-1.5">{d.tags.map((t) => <Badge key={t}>#{t}</Badge>)}</div>}
          {d.deid.length > 0 && (
            <section className="rounded-xl border border-border p-3 text-xs">
              <h2 className="font-semibold">De-identification report</h2>
              <ul className="mt-1.5 space-y-1 text-muted">{d.deid.map((r, i) => <li key={i}><span className="font-medium text-fg">{r.file}</span>: {r.findings.map((f) => `${f.name} (${f.action})`).join(", ") || "no changes"}{r.burnedIn ? " — burned-in text possible, inspect pixels" : ""}</li>)}</ul>
            </section>
          )}
          {published && d.viewer.unlocked === false && <button onClick={() => setTab("observations")} className="text-sm font-medium text-accent hover:underline">Write your own observation first →</button>}
        </div>
      )}

      {tab === "observations" && (
        <ObservationsPanel caseId={d.id} observations={d.observations} mine={d.myObservation} lockedCount={d.lockedObservationCount} unlocked={d.viewer.unlocked}
          comments={d.comments} isStaff={d.viewer.isStaff} canInteract={canInteract} draftSeed={seed} />
      )}

      {tab === "discussion" && (d.viewer.unlocked ? (
        <CommentThread caseId={d.id} comments={d.comments} isStaff={d.viewer.isStaff} />
      ) : (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-muted"><Lock className="h-4 w-4" />Discussion is hidden until you submit an observation or choose to skip, so you can read the images independently.</p>
          <RevealGate caseId={d.id} hasObserved={d.viewer.hasObserved} count={d.counts.observations - (d.viewer.hasObserved ? 1 : 0)} />
        </div>
      ))}

      {tab === "ai" && (published ? (
        <AiPanel caseId={d.id} unlocked={d.viewer.unlocked} configured={aiConfigured} onUseDraft={(t) => { setSeed(t); setTab("observations"); }} />
      ) : <p className="text-sm text-muted">The AI assistant is available once the case is published.</p>)}
    </div>
  );
}
