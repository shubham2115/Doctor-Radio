"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EyeOff, Lock, Pencil, Plus, ThumbsUp, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { TimeAgo } from "@/components/ui/time-ago";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { Markdown, MarkdownEditor } from "@/components/ui/markdown";
import { CommentThread } from "./discussion";
import { ReportButton } from "./case-actions";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { DESIGNATIONS } from "@/lib/validation/profile";
import type { CommentView, ObsView } from "@/server/services/case-detail";

const CONF = { LOW: "Low confidence", MODERATE: "Moderate confidence", HIGH: "High confidence" } as const;

type Draft = { findings: string; impression: string; comments: string; references: string; signs: string[]; confidence: string; differentials: { diagnosis: string; rationale: string }[] };
const fromObs = (o?: ObsView | null): Draft => ({
  findings: o?.findings ?? "", impression: o?.impression ?? "", comments: o?.comments ?? "", references: o?.references ?? "",
  signs: o?.imagingSigns ?? [], confidence: o?.confidence ?? "", differentials: o?.differentials.map((d) => ({ diagnosis: d.diagnosis, rationale: d.rationale ?? "" })) ?? [],
});

/** Structured editor: findings, impression, differentials, signs, references, additional comments, confidence. */
export function ObservationEditor({ caseId, existing, onClose, seed }: { caseId: string; existing?: ObsView | null; onClose?: () => void; seed?: string }) {
  const router = useRouter();
  const [d, setD] = useState<Draft>(() => ({ ...fromObs(existing), comments: existing?.comments ?? seed ?? "" }));
  const [signText, setSignText] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  async function save() {
    setBusy(true); setErrors({});
    try {
      await api(`/api/cases/${caseId}/observation`, "PUT", {
        findings: d.findings, impression: d.impression, comments: d.comments, references: d.references,
        imagingSigns: d.signs, confidence: d.confidence || undefined,
        differentials: d.differentials.filter((x) => x.diagnosis.trim()),
      });
      toast.success(existing ? "Observation updated" : "Observation submitted — you can now reveal others'");
      onClose?.(); router.refresh();
    } catch (e) {
      if (e instanceof ApiError) { setErrors(e.fieldErrors ?? {}); toast.error(e.fieldErrors ? "Please fix the highlighted fields" : e.message); }
    } finally { setBusy(false); }
  }
  const addSign = () => { const t = signText.trim(); if (t && !d.signs.includes(t) && d.signs.length < 10) set("signs", [...d.signs, t]); setSignText(""); };

  return (
    <div className="space-y-4">
      <div>
        <Label>Findings</Label>
        <MarkdownEditor value={d.findings} onChange={(v) => set("findings", v)} placeholder="Describe what you see, systematically…" maxLength={5000} className="min-h-28" />
        <FieldError message={errors.findings?.[0]} />
      </div>
      <div>
        <Label>Impression</Label>
        <MarkdownEditor value={d.impression} onChange={(v) => set("impression", v)} placeholder="Your summary / most likely interpretation (educational)" maxLength={2000} className="min-h-16" />
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between"><Label className="mb-0">Differential diagnosis</Label>
          {d.differentials.length < 8 && <Button type="button" variant="ghost" size="sm" onClick={() => set("differentials", [...d.differentials, { diagnosis: "", rationale: "" }])}><Plus className="h-3.5 w-3.5" />Add</Button>}</div>
        <div className="space-y-2">
          {d.differentials.map((x, i) => (
            <div key={i} className="flex gap-2 rounded-xl bg-surface-2 p-2.5">
              <span className="mt-2 w-4 text-center text-xs font-semibold text-subtle">{i + 1}</span>
              <div className="flex-1 space-y-1.5">
                <Input value={x.diagnosis} placeholder="Diagnosis" maxLength={160} onChange={(e) => set("differentials", d.differentials.map((y, j) => (j === i ? { ...y, diagnosis: e.target.value } : y)))} />
                <Input value={x.rationale} placeholder="Why? (supporting / opposing features)" maxLength={1000} onChange={(e) => set("differentials", d.differentials.map((y, j) => (j === i ? { ...y, rationale: e.target.value } : y)))} />
              </div>
              <button type="button" aria-label="Remove differential" onClick={() => set("differentials", d.differentials.filter((_, j) => j !== i))} className="self-start p-1.5 text-subtle hover:text-danger"><X className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </div>
      <div>
        <Label>Imaging signs <span className="font-normal text-subtle">(optional)</span></Label>
        <div className="flex flex-wrap gap-1.5 rounded-[10px] border border-border p-2">
          {d.signs.map((s) => <span key={s} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">{s}<button type="button" aria-label={`Remove ${s}`} onClick={() => set("signs", d.signs.filter((x) => x !== s))}><X className="h-3 w-3" /></button></span>)}
          <input value={signText} onChange={(e) => setSignText(e.target.value)} onBlur={addSign} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSign(); } }} placeholder="e.g. target sign, dural tail" className="min-w-32 flex-1 bg-transparent px-1.5 text-sm outline-none" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <div><Label>Educational references <span className="font-normal text-subtle">(optional)</span></Label><Input value={d.references} maxLength={2000} onChange={(e) => set("references", e.target.value)} placeholder="Radiopaedia article, paper, textbook…" /></div>
        <div><Label>Confidence <span className="font-normal text-subtle">(optional)</span></Label>
          <Select value={d.confidence} onChange={(e) => set("confidence", e.target.value)}><option value="">Not stated</option>{Object.entries(CONF).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></div>
      </div>
      <div><Label>Additional comments <span className="font-normal text-subtle">(optional)</span></Label><MarkdownEditor value={d.comments} onChange={(v) => set("comments", v)} maxLength={3000} className="min-h-16" /></div>
      <p className="text-xs text-subtle">Do not include patient-identifying information. Your observation is attributed to you and timestamped; nobody else can overwrite it.</p>
      <div className="flex justify-end gap-2">{onClose && <Button variant="ghost" onClick={onClose}>Cancel</Button>}<Button onClick={save} loading={busy} disabled={d.findings.trim().length < 10}>{existing ? "Save changes" : "Submit observation"}</Button></div>
    </div>
  );
}

function ObservationCard({ o, caseId, comments, isStaff, canInteract }: { o: ObsView; caseId: string; comments: CommentView[]; isStaff: boolean; canInteract: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [help, setHelp] = useState({ on: o.helpedByMe, n: o.helpfulCount });
  const desig = DESIGNATIONS.find((x) => x.value === o.authorDesignation)?.label;

  async function toggleHelp() {
    const was = help.on;
    setHelp({ on: !was, n: help.n + (was ? -1 : 1) });
    try { await api(`/api/observations/${o.id}/helpful`, was ? "DELETE" : "POST"); router.refresh(); } catch { setHelp({ on: was, n: help.n }); toast.error("Could not update"); }
  }
  async function remove() {
    if (!confirm("Withdraw your observation? Others' replies to it will be hidden.")) return;
    try { await api(`/api/cases/${caseId}/observation`, "DELETE"); router.refresh(); } catch { toast.error("Could not delete"); }
  }

  if (editing) return <Card className="p-4"><ObservationEditor caseId={caseId} existing={o} onClose={() => setEditing(false)} /></Card>;

  const section = (title: string, body?: string | null) => body ? <div className="mt-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-subtle">{title}</p><Markdown>{body}</Markdown></div> : null;
  return (
    <Card className={cn("p-4", o.mine && "border-accent/40")}>
      <div className="flex items-center gap-3">
        <Avatar name={o.authorName} src={o.authorAvatar} size={34} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{o.authorUsername ? <Link href={`/u/${o.authorUsername}`} className="hover:text-accent">{o.authorName}</Link> : o.authorName}{o.mine && <Badge tone="accent" className="ml-2">You</Badge>}</p>
          <p className="text-xs text-muted">{desig ? `${desig} · ` : ""}<TimeAgo date={o.createdAt} />{o.editedAt ? " · edited" : ""}</p>
        </div>
        {o.confidence && <Badge>{CONF[o.confidence]}</Badge>}
      </div>
      {section("Findings", o.findings)}
      {section("Impression", o.impression)}
      {o.differentials.length > 0 && (
        <div className="mt-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Differential diagnosis</p>
          <ol className="mt-1 space-y-1 text-sm">{o.differentials.map((d, i) => <li key={i}><span className="font-medium">{i + 1}. {d.diagnosis}</span>{d.rationale && <span className="text-muted"> — {d.rationale}</span>}</li>)}</ol></div>
      )}
      {o.imagingSigns.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{o.imagingSigns.map((s) => <Badge key={s} tone="accent">{s}</Badge>)}</div>}
      {section("Additional comments", o.comments)}
      {section("References", o.references)}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
        {!o.mine && canInteract && <Button variant={help.on ? "primary" : "secondary"} size="sm" onClick={toggleHelp} aria-pressed={help.on}><ThumbsUp className="h-3.5 w-3.5" />Helpful{help.n > 0 ? ` · ${help.n}` : ""}</Button>}
        {o.mine && help.n > 0 && <span className="text-xs text-muted">{help.n} found this helpful</span>}
        {o.mine && <><Button variant="ghost" size="sm" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" />Edit</Button><Button variant="ghost" size="sm" onClick={remove}><Trash2 className="h-3.5 w-3.5" />Withdraw</Button></>}
        {!o.mine && canInteract && <span className="ml-auto"><ReportButton targetType="OBSERVATION" targetId={o.id} compact /></span>}
      </div>
      <CommentThread caseId={caseId} comments={comments} observationId={o.id} isStaff={isStaff} compact />
    </Card>
  );
}

export function RevealGate({ caseId, hasObserved, count }: { caseId: string; hasObserved: boolean; count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function reveal(skip: boolean) {
    setBusy(true);
    try { await api(`/api/cases/${caseId}/reveal`, "POST", { skip }); router.refresh(); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not reveal"); }
    finally { setBusy(false); }
  }
  return (
    <Card className="border-dashed p-6 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent">{hasObserved ? <EyeOff className="h-5 w-5" /> : <Lock className="h-5 w-5" />}</span>
      <h3 className="mt-3 font-semibold tracking-tight">{count} observation{count === 1 ? "" : "s"} from the community</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{hasObserved ? "You've committed to your own read. Ready to compare it with others?" : "Write your own observation first to avoid anchoring on others' answers — or skip straight to the discussion."}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {hasObserved && <Button onClick={() => reveal(false)} loading={busy}>Reveal other observations</Button>}
        <Button variant="secondary" onClick={() => reveal(true)} disabled={busy}>{hasObserved ? "Skip" : "Skip & view discussion"}</Button>
      </div>
    </Card>
  );
}

export function ObservationsPanel(props: { caseId: string; observations: ObsView[]; mine: ObsView | null; lockedCount: number; unlocked: boolean; comments: CommentView[]; isStaff: boolean; canInteract: boolean; draftSeed?: string }) {
  const [composing, setComposing] = useState(false);
  const { caseId, observations, mine, lockedCount, unlocked, comments, isStaff, canInteract } = props;
  return (
    <div className="space-y-4">
      {canInteract && !mine && (composing ? (
        <Card className="p-4"><h3 className="mb-3 font-semibold tracking-tight">Your independent observation</h3><ObservationEditor caseId={caseId} onClose={() => setComposing(false)} seed={props.draftSeed} /></Card>
      ) : (
        <Card className="flex items-center justify-between gap-4 p-4">
          <div><h3 className="font-semibold tracking-tight">What do you see?</h3><p className="text-sm text-muted">Write your read before looking at others&apos; for the best learning.</p></div>
          <Button onClick={() => setComposing(true)}><Plus className="h-4 w-4" />Write observation</Button>
        </Card>
      ))}
      {mine && <ObservationCard o={mine} caseId={caseId} comments={comments} isStaff={isStaff} canInteract={canInteract} />}
      {!unlocked && lockedCount > 0 && <RevealGate caseId={caseId} hasObserved={Boolean(mine)} count={lockedCount} />}
      {!unlocked && lockedCount === 0 && !mine && <p className="py-4 text-center text-sm text-muted">No observations yet — be the first.</p>}
      {unlocked && observations.map((o) => <ObservationCard key={o.id} o={o} caseId={caseId} comments={comments} isStaff={isStaff} canInteract={canInteract} />)}
      {unlocked && observations.length === 0 && !mine && <p className="py-4 text-center text-sm text-muted">No observations yet — be the first.</p>}
    </div>
  );
}
