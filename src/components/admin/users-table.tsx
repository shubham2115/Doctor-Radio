"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { BadgeCheck, Ban, KeyRound, Plus, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { TimeAgo } from "@/components/ui/time-ago";
import { api, ApiError } from "@/lib/api-client";
import { DESIGNATIONS } from "@/lib/validation/profile";

export type UserRow = {
  id: string; email: string; name: string | null; role: "MEMBER" | "MODERATOR" | "ADMIN"; status: "ACTIVE" | "SUSPENDED" | "DELETED";
  createdAt: string; lastLoginAt: string | null; username: string | null; verification: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED" | null;
};

const ROLE_TONE = { ADMIN: "danger", MODERATOR: "warning", MEMBER: "neutral" } as const;
const ROLE_LABEL = { ADMIN: "Admin", MODERATOR: "Moderator", MEMBER: "Member" } as const;

function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return [...bytes].map((b) => chars[b % chars.length]).join("") + "aA1";
}

export function CreateUserDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [v, setV] = useState({ name: "", email: "", password: "", role: "MEMBER", designation: "CONSULTANT", verified: true });

  async function create() {
    setBusy(true); setErrors({});
    try {
      await api("/api/admin/users", "POST", v);
      toast.success(`User created. Share the password with ${v.email} securely.`);
      setOpen(false); setV({ ...v, name: "", email: "", password: "" });
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) { setErrors(e.fieldErrors ?? {}); if (!e.fieldErrors) toast.error(e.message); }
    } finally { setBusy(false); }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild><Button><Plus className="h-4 w-4" />Add user</Button></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-navy/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[70] max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-lg)]">
          <Dialog.Title className="text-lg font-semibold">Add a user</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted">Creates the account immediately with the role you choose. They can change their password via “Forgot password”.</Dialog.Description>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label htmlFor="cu-name">Full name</Label><Input id="cu-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
              <FieldError message={errors.name?.[0]} /></div>
            <div className="sm:col-span-2"><Label htmlFor="cu-email">Email</Label><Input id="cu-email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
              <FieldError message={errors.email?.[0]} /></div>
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between"><Label htmlFor="cu-pw">Temporary password</Label>
                <button type="button" onClick={() => setV({ ...v, password: genPassword() })} className="mb-1.5 text-xs text-accent hover:underline">Generate</button></div>
              <Input id="cu-pw" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} autoComplete="off" placeholder="10+ chars, upper, lower, number" />
              <FieldError message={errors.password?.[0]} /></div>
            <div><Label htmlFor="cu-role">Role</Label>
              <Select id="cu-role" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })}>
                <option value="MEMBER">Member</option><option value="MODERATOR">Moderator</option><option value="ADMIN">Admin</option></Select></div>
            <div><Label htmlFor="cu-des">Designation</Label>
              <Select id="cu-des" value={v.designation} onChange={(e) => setV({ ...v, designation: e.target.value })}>
                {DESIGNATIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</Select></div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={v.verified} onChange={(e) => setV({ ...v, verified: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />Mark as verified doctor (can upload cases)</label>
          </div>
          <div className="mt-6 flex justify-end gap-2"><Dialog.Close asChild><Button variant="ghost">Cancel</Button></Dialog.Close><Button onClick={create} loading={busy}>Create user</Button></div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Row({ u, selfId }: { u: UserRow; selfId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const isSelf = u.id === selfId;

  async function patch(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    try { await api(`/api/admin/users/${u.id}`, "PATCH", body); toast.success(ok); router.refresh(); }
    catch (e) { toast.error(e instanceof ApiError ? (e.fieldErrors ? Object.values(e.fieldErrors)[0]?.[0] ?? e.message : e.message) : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <tr className="border-t border-border align-middle">
      <td className="px-5 py-3">
        <div className="flex items-center gap-3"><Avatar name={u.name} size={34} />
          <div className="min-w-0"><p className="truncate text-sm font-medium">{u.name ?? "—"}{isSelf && <Badge tone="accent" className="ml-2">You</Badge>}</p><p className="truncate text-xs text-muted">{u.email}</p></div></div>
      </td>
      <td className="px-3 py-3">
        <Select aria-label={`Role for ${u.email}`} value={u.role} disabled={busy || isSelf} className="h-8 w-32 text-[13px]"
          onChange={(e) => confirm(`Change ${u.email} to ${ROLE_LABEL[e.target.value as UserRow["role"]]}?`) && patch({ role: e.target.value }, "Role updated")}>
          <option value="MEMBER">Member</option><option value="MODERATOR">Moderator</option><option value="ADMIN">Admin</option>
        </Select>
      </td>
      <td className="px-3 py-3"><div className="flex flex-wrap gap-1.5">
        {u.status === "SUSPENDED" ? <Badge tone="danger">Suspended</Badge> : <Badge tone="success">Active</Badge>}
        {u.verification === "VERIFIED" ? <Badge tone="accent"><BadgeCheck className="h-3 w-3" />Verified</Badge> : u.verification === "PENDING" ? <Badge tone="warning">Pending</Badge> : u.verification ? <Badge>Unverified</Badge> : <Badge>No profile</Badge>}
        <Badge tone={ROLE_TONE[u.role]} className="hidden xl:inline-flex">{ROLE_LABEL[u.role]}</Badge>
      </div></td>
      <td className="hidden px-3 py-3 text-xs text-muted lg:table-cell">{u.lastLoginAt ? <TimeAgo date={u.lastLoginAt} /> : "never"}</td>
      <td className="px-5 py-3"><div className="flex justify-end gap-1.5">
        {u.verification && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => patch({ verified: u.verification !== "VERIFIED" }, u.verification === "VERIFIED" ? "Verification removed" : "Verified")}>
            <ShieldCheck className="h-3.5 w-3.5" />{u.verification === "VERIFIED" ? "Unverify" : "Verify"}
          </Button>
        )}
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => { const p = prompt(`New password for ${u.email} (10+ chars, upper, lower, number):`); if (p) patch({ password: p }, "Password reset"); }}><KeyRound className="h-3.5 w-3.5" />Reset</Button>
        {!isSelf && (u.status === "SUSPENDED"
          ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => patch({ status: "ACTIVE" }, "Account reinstated")}><RotateCcw className="h-3.5 w-3.5" />Reinstate</Button>
          : <Button size="sm" variant="ghost" className="text-danger hover:bg-danger/10" disabled={busy} onClick={() => confirm(`Suspend ${u.email}? They will be signed out and unable to log in.`) && patch({ status: "SUSPENDED" }, "Account suspended")}><Ban className="h-3.5 w-3.5" />Suspend</Button>)}
      </div></td>
    </tr>
  );
}

export function UsersTable({ users, selfId }: { users: UserRow[]; selfId: string }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left">
        <thead><tr className="text-xs text-subtle"><th className="px-5 py-3 font-medium">User</th><th className="px-3 py-3 font-medium">Role</th><th className="px-3 py-3 font-medium">Status</th><th className="hidden px-3 py-3 font-medium lg:table-cell">Last login</th><th className="px-5 py-3 text-right font-medium">Actions</th></tr></thead>
        <tbody>{users.map((u) => <Row key={u.id} u={u} selfId={selfId} />)}</tbody>
      </table>
    </Card>
  );
}
