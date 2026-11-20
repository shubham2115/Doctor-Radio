"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

function useAct() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return {
    busy,
    async act(url: string, body: unknown, ok: string) {
      setBusy(true);
      try { await api(url, "POST", body); toast.success(ok); router.refresh(); }
      catch (e) { toast.error(e instanceof ApiError ? e.message : "Failed"); }
      finally { setBusy(false); }
    },
  };
}

export function VerificationActions({ id }: { id: string }) {
  const { busy, act } = useAct();
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => { const note = prompt("Reason for rejection (shown to the user):"); if (note) act(`/api/admin/verifications/${id}`, { decision: "reject", note }, "Rejected"); }}>Reject</Button>
      <Button size="sm" disabled={busy} onClick={() => act(`/api/admin/verifications/${id}`, { decision: "approve" }, "Verified")}>Verify</Button>
    </div>
  );
}

export function ReportActions({ id }: { id: string }) {
  const { busy, act } = useAct();
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(`/api/admin/reports/${id}`, { action: "dismiss" }, "Report dismissed")}>Dismiss</Button>
      <Button size="sm" variant="danger" disabled={busy} onClick={() => confirm("Remove this content?") && act(`/api/admin/reports/${id}`, { action: "remove" }, "Content removed")}>Remove content</Button>
    </div>
  );
}
