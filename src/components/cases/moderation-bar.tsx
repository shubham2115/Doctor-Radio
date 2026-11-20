"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api-client";

export function ModerationBar({ caseId, redirectTo }: { caseId: string; redirectTo?: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  async function decide(decision: "approve" | "reject") {
    setBusy(decision);
    try {
      await api(`/api/admin/cases/${caseId}/review`, "POST", { decision, reason });
      toast.success(decision === "approve" ? "Case published" : "Case returned to the author");
      router.push(redirectTo ?? "/admin"); router.refresh();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "Failed"); }
    finally { setBusy(null); }
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3">
      <span className="text-sm font-medium">Moderator review</span>
      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required to reject)" className="h-9 min-w-48 flex-1" maxLength={500} />
      <Button size="sm" variant="danger" onClick={() => decide("reject")} loading={busy === "reject"} disabled={!reason.trim() || busy !== null}>Return</Button>
      <Button size="sm" onClick={() => decide("approve")} loading={busy === "approve"} disabled={busy !== null}>Approve &amp; publish</Button>
    </div>
  );
}
