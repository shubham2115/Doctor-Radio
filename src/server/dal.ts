import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/server/db";
import { HttpError } from "@/server/http";

/** Data Access Layer: every protected page / API goes through one of these. */

export const getSessionUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  return db.user.findUnique({
    where: { id: session.user.id },
    include: { profile: { include: { institution: true } } },
  });
});

export async function requireUser() {
  const user = await getSessionUser();
  if (!user || user.status !== "ACTIVE") redirect("/login");
  return user;
}

/** For pages: signed in AND finished onboarding (profile exists). */
export async function requireOnboardedUser() {
  const user = await requireUser();
  if (!user.profile) redirect("/onboarding");
  return { ...user, profile: user.profile };
}

const rank: Record<Role, number> = { MEMBER: 0, MODERATOR: 1, ADMIN: 2 };

export async function requireRole(min: Role) {
  const user = await requireOnboardedUser();
  if (rank[user.role] < rank[min]) redirect("/home");
  return user;
}

/** For API routes: throw instead of redirecting. */
export async function apiUser(min: Role = "MEMBER") {
  const session = await auth();
  if (!session?.user?.id) throw new HttpError(401, "Not signed in");
  if (rank[session.user.role] < rank[min]) throw new HttpError(403, "Forbidden");
  return session.user;
}
