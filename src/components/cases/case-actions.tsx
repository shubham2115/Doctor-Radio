"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Bookmark, Flag, Heart, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, Textarea, Label } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function ReportButton({ targetType, targetId, label = "Report", compact }: { targetType: "CASE" | "COMMENT" | "OBSERVATION"; targetId: string; label?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("Patient identifiable information");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try { await api("/api/reports", "POST", { targetType, targetId, reason, details }); toast.success("Thanks — a moderator will review this."); setOpen(false); setDetails(""); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not send report"); }
    finally { setBusy(false); }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        {compact ? <button className="text-xs text-subtle hover:text-danger" aria-label={label}>Report</button> : <Button variant="ghost" size="sm"><Flag className="h-4 w-4" />{label}</Button>}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-navy/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[70] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-lg)]">
          <Dialog.Title className="text-lg font-semibold">Report {targetType.toLowerCase()}</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted">Reports are reviewed by moderators. Patient-identifiable content is removed immediately.</Dialog.Description>
          <div className="mt-4 space-y-4">
            <div><Label htmlFor="reason">Reason</Label>
              <Select id="reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                {["Patient identifiable information", "Inappropriate content", "Incorrect or misleading", "Spam", "Other"].map((r) => <option key={r}>{r}</option>)}
              </Select></div>
            <div><Label htmlFor="details">Details <span className="font-normal text-subtle">(optional)</span></Label><Textarea id="details" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} /></div>
          </div>
          <div className="mt-5 flex justify-end gap-2"><Dialog.Close asChild><Button variant="ghost">Cancel</Button></Dialog.Close><Button onClick={send} loading={busy}>Submit report</Button></div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function CaseActions({ caseId, liked, bookmarked, likes, canInteract }: { caseId: string; liked: boolean; bookmarked: boolean; likes: number; canInteract: boolean }) {
  const router = useRouter();
  const [s, setS] = useState({ liked, bookmarked, likes });

  async function toggle(kind: "like" | "bookmark") {
    const was = kind === "like" ? s.liked : s.bookmarked;
    setS((p) => (kind === "like" ? { ...p, liked: !was, likes: p.likes + (was ? -1 : 1) } : { ...p, bookmarked: !was })); // optimistic
    try { await api(`/api/cases/${caseId}/${kind}`, was ? "DELETE" : "POST"); router.refresh(); }
    catch { setS((p) => (kind === "like" ? { ...p, liked: was, likes: p.likes + (was ? 1 : -1) } : { ...p, bookmarked: was })); toast.error("Something went wrong"); }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button variant="secondary" size="sm" disabled={!canInteract} onClick={() => toggle("like")} aria-pressed={s.liked}>
        <Heart className={cn("h-4 w-4", s.liked && "fill-danger text-danger")} />{s.likes}
      </Button>
      <Button variant="secondary" size="sm" disabled={!canInteract} onClick={() => toggle("bookmark")} aria-pressed={s.bookmarked}>
        <Bookmark className={cn("h-4 w-4", s.bookmarked && "fill-accent text-accent")} />{s.bookmarked ? "Saved" : "Save"}
      </Button>
      <Button variant="secondary" size="sm" onClick={async () => { await navigator.clipboard.writeText(`${location.origin}/cases/${caseId}`); toast.success("Link copied — share it with members"); }}>
        <Link2 className="h-4 w-4" />Share
      </Button>
      {canInteract && <ReportButton targetType="CASE" targetId={caseId} />}
    </div>
  );
}
