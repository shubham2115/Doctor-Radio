import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Search, Users } from "lucide-react";
import type { Prisma, Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/dal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateUserDialog, UsersTable, type UserRow } from "@/components/admin/users-table";

export const metadata: Metadata = { title: "Manage users" };

const PAGE = 20;
const ROLES = ["ADMIN", "MODERATOR", "MEMBER"] as const;

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; cursor?: string }> }) {
  const me = await requireRole("ADMIN");
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 100);
  const role = ROLES.find((r) => r === sp.role);

  const where: Prisma.UserWhereInput = { status: { not: "DELETED" } };
  if (role) where.role = role as Role;
  if (q) where.OR = [
    { email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } },
    { profile: { username: { contains: q, mode: "insensitive" } } },
  ];

  const [rows, total] = await Promise.all([
    db.user.findMany({
      where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: PAGE + 1,
      ...(sp.cursor ? { cursor: { id: sp.cursor }, skip: 1 } : {}),
      select: { id: true, email: true, name: true, role: true, status: true, createdAt: true, lastLoginAt: true, profile: { select: { username: true, verificationStatus: true } } },
    }),
    db.user.count({ where }),
  ]);
  const more = rows.length > PAGE;
  const page = rows.slice(0, PAGE);
  const users: UserRow[] = page.map((u) => ({
    id: u.id, email: u.email, name: u.name, role: u.role, status: u.status, createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null, username: u.profile?.username ?? null, verification: u.profile?.verificationStatus ?? null,
  }));
  const qs = (extra: Record<string, string>) => new URLSearchParams({ ...(q ? { q } : {}), ...(role ? { role } : {}), ...extra }).toString();

  return (
    <div className="space-y-6">
      <Link href="/admin" className="flex items-center gap-1.5 text-sm text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" />Moderation</Link>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><Users className="h-5 w-5" /></span>
        <div className="flex-1"><h1 className="text-2xl font-semibold tracking-tight">Users</h1><p className="text-sm text-muted">{total} account{total === 1 ? "" : "s"} · create users, assign roles, verify or suspend.</p></div>
        <CreateUserDialog />
      </div>

      <form className="flex flex-wrap gap-2" role="search">
        <div className="relative min-w-60 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input name="q" defaultValue={q} placeholder="Search name, email or username" className="h-10 w-full rounded-[10px] border border-border bg-surface pl-9 pr-3 text-sm placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-4 focus:ring-[var(--ring)]" /></div>
        <select name="role" defaultValue={role ?? ""} aria-label="Filter by role" className="h-10 rounded-[10px] border border-border bg-surface px-3 text-sm">
          <option value="">All roles</option><option value="ADMIN">Admins</option><option value="MODERATOR">Moderators</option><option value="MEMBER">Members</option></select>
        <Button type="submit" variant="secondary">Filter</Button>
      </form>

      {users.length === 0 ? <Card><EmptyState icon={Users} title="No users found" description="Try a different search or filter." /></Card> : <UsersTable users={users} selfId={me.id} />}
      {more && <div className="flex justify-center"><Button asChild variant="secondary"><Link href={`/admin/users?${qs({ cursor: page[page.length - 1].id })}`}>Next page</Link></Button></div>}
    </div>
  );
}
