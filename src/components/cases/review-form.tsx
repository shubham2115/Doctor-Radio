"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileText, ScanLine, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export type ReviewFile = {
  id: string; kind: "IMAGE" | "PDF" | "DICOM" | "ARCHIVE"; name: string; thumbUrl: string | null;
  scan: string; findings: { name: string; action: string }[]; burnedIn: boolean; frames: number | null;
};

export function ReviewForm({ caseId, files, rejection }: { caseId: string; files: ReviewFile[]; rejection?: string | null }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set(files.map((f) => f.id)));
  const [a, setA] = useState({ deidentified: false, authorized: false, noBurnedInText: false });
  const [busy, setBusy] = useState(false);
  const allChecked = a.deidentified && a.authorized && a.noBurnedInText;

  const toggle = (id: string) => setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function submit() {
    setBusy(true);
    try {
      await api(`/api/cases/${caseId}/submit`, "POST", { ...a, selectedFileIds: [...sel] });
      toast.success("Submitted for moderator review");
      router.push("/cases/mine");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? (err.fieldErrors ? Object.values(err.fieldErrors)[0]?.[0] ?? err.message : err.message) : "Could not submit");
    } finally { setBusy(false); }
  }

  async function discard() {
    if (!confirm("Delete this draft and all its files permanently?")) return;
    try { await api(`/api/cases/${caseId}`, "DELETE"); toast.success("Draft deleted"); router.push("/cases/new"); router.refresh(); }
    catch { toast.error("Could not delete"); }
  }

  const check = (k: keyof typeof a, label: string) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3.5 text-sm transition-colors hover:bg-surface-2">
      <input type="checkbox" checked={a[k]} onChange={(e) => setA({ ...a, [k]: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
      <span>{label}</span>
    </label>
  );

  return (
    <div className="space-y-6">
      {rejection && (
        <div className="flex gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm"><AlertTriangle className="h-5 w-5 shrink-0 text-danger" /><div><p className="font-medium">A moderator returned this case</p><p className="mt-0.5 text-muted">{rejection}</p></div></div>
      )}
      <div>
        <div className="mb-3 flex items-end justify-between">
          <div><h2 className="font-semibold tracking-tight">Choose what to publish</h2><p className="text-sm text-muted">{sel.size} of {files.length} files selected. Unselected files are permanently deleted on submit.</p></div>
          <div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => setSel(new Set(files.map((f) => f.id)))}>All</Button><Button variant="ghost" size="sm" onClick={() => setSel(new Set())}>None</Button></div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {files.map((f) => {
            const on = sel.has(f.id);
            return (
              <button key={f.id} type="button" onClick={() => toggle(f.id)} aria-pressed={on}
                className={cn("group overflow-hidden rounded-xl border-2 text-left transition-all", on ? "border-accent shadow-[var(--shadow-sm)]" : "border-border opacity-55 hover:opacity-90")}>
                <div className="relative flex aspect-square items-center justify-center bg-navy">
                  {f.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.thumbUrl} alt="" className="h-full w-full object-cover" />
                  ) : f.kind === "DICOM" ? <ScanLine className="h-8 w-8 text-accent" /> : <FileText className="h-8 w-8 text-white/70" />}
                  <span className={cn("absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-md border text-[11px] font-bold", on ? "border-accent bg-accent text-accent-fg" : "border-white/60 bg-black/30 text-transparent")}>✓</span>
                  {f.scan === "INFECTED" && <Badge tone="danger" className="absolute bottom-2 left-2">Infected</Badge>}
                </div>
                <div className="p-2.5"><p className="truncate text-xs font-medium" title={f.name}>{f.name}</p><p className="text-[11px] text-subtle">{f.kind}{f.frames && f.frames > 1 ? ` · ${f.frames} frames` : ""}</p></div>
              </button>
            );
          })}
        </div>
      </div>

      <Card className="p-6">
        <h2 className="flex items-center gap-2 font-semibold tracking-tight"><ShieldCheck className="h-4 w-4 text-accent" />De-identification report</h2>
        <p className="mt-1 text-sm text-muted">What the system removed automatically, and what still needs your eyes.</p>
        <ul className="mt-4 divide-y divide-border text-sm">
          {files.map((f) => {
            const removed = f.findings.filter((x) => x.action !== "flagged");
            const flagged = f.findings.filter((x) => x.action === "flagged");
            return (
              <li key={f.id} className="py-3">
                <p className="font-medium">{f.name}</p>
                {removed.length > 0 && <p className="mt-1 text-xs text-muted">Removed/remapped: {[...new Set(removed.map((x) => x.name))].join(", ")}</p>}
                {flagged.map((x) => <p key={x.name} className="mt-1 flex items-start gap-1.5 text-xs text-warning"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{x.name}</p>)}
                {f.burnedIn && flagged.length === 0 && <p className="mt-1 text-xs text-warning">Check pixels for burned-in text.</p>}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="space-y-3 p-6">
        <h2 className="font-semibold tracking-tight">Confirmations</h2>
        {check("deidentified", "I confirm that this case has been appropriately de-identified: no patient name, ID, date of birth, accession number, contact details or other identifying information remains in the text or files.")}
        {check("noBurnedInText", "I have visually checked every selected image and it contains no burned-in identifying text (names, IDs, dates, hospital labels).")}
        {check("authorized", "I am authorised to share this case for educational purposes, and I understand it will be reviewed by moderators before publication.")}
        <div className="flex flex-wrap justify-between gap-3 pt-2">
          <Button variant="ghost" onClick={discard} className="text-danger hover:bg-danger/10">Delete draft</Button>
          <Button onClick={submit} loading={busy} disabled={!allChecked || sel.size === 0}>Submit for review</Button>
        </div>
      </Card>
    </div>
  );
}
