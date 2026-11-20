import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { signedFileUrl } from "@/server/signing";
import type { Difficulty, Modality } from "@prisma/client";

/** Fields every case card needs. Only PUBLISHED, non-deleted cases are ever listed. */
export const caseCardSelect = {
  id: true,
  title: true,
  modality: true,
  bodyRegion: true,
  difficulty: true,
  publishedAt: true,
  likeCount: true,
  commentCount: true,
  observationCount: true,
  author: { select: { profile: { select: { displayName: true, username: true, avatarUrl: true } } } },
  files: { where: { selected: true, thumbKey: { not: null } }, orderBy: { position: "asc" }, take: 1, select: { id: true } },
} satisfies Prisma.CaseSelect;

export type CaseCardData = Prisma.CaseGetPayload<{ select: typeof caseCardSelect }>;

/** Serializable shape handed to client components (no Dates/BigInts; thumbnail already signed). */
export type CaseCardView = {
  id: string; title: string; modality: Modality; bodyRegion: string; difficulty: Difficulty;
  publishedAt: string | null; likeCount: number; commentCount: number; observationCount: number;
  authorName: string; authorAvatar: string | null; thumbUrl: string | null;
};

export function toCardView(c: CaseCardData): CaseCardView {
  const p = c.author.profile;
  return {
    id: c.id, title: c.title, modality: c.modality, bodyRegion: c.bodyRegion, difficulty: c.difficulty,
    publishedAt: c.publishedAt?.toISOString() ?? null, likeCount: c.likeCount, commentCount: c.commentCount,
    observationCount: c.observationCount, authorName: p?.displayName ?? "Member", authorAvatar: p?.avatarUrl ?? null,
    thumbUrl: c.files[0] ? signedFileUrl(c.files[0].id, "thumb") : null,
  };
}

const published: Prisma.CaseWhereInput = { status: "PUBLISHED", deletedAt: null };

export const trendingCases = (take = 4) =>
  db.case.findMany({
    where: { ...published, publishedAt: { gte: new Date(Date.now() - 14 * 86400_000) } },
    orderBy: [{ commentCount: "desc" }, { likeCount: "desc" }, { publishedAt: "desc" }],
    take,
    select: caseCardSelect,
  });

export const recentCases = (take = 6) =>
  db.case.findMany({ where: published, orderBy: { publishedAt: "desc" }, take, select: caseCardSelect });

export const awaitingDiscussion = (take = 4) =>
  db.case.findMany({
    where: { ...published, observationCount: 0 },
    orderBy: { publishedAt: "desc" },
    take,
    select: caseCardSelect,
  });

/** Recommended: published cases by others that the user has not yet observed, newest first. */
export const recommendedCases = (userId: string, take = 4) =>
  db.case.findMany({
    where: { ...published, authorId: { not: userId }, observations: { none: { authorId: userId } } },
    orderBy: { publishedAt: "desc" },
    take,
    select: caseCardSelect,
  });

export const savedCases = async (userId: string, take = 4) => {
  const rows = await db.bookmark.findMany({
    where: { userId, case: published },
    orderBy: { createdAt: "desc" },
    take,
    select: { case: { select: caseCardSelect } },
  });
  return rows.map((r) => r.case);
};

export const myRecentObservations = (userId: string, take = 5) =>
  db.observation.findMany({
    where: { authorId: userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, impression: true, findings: true, createdAt: true, case: { select: { id: true, title: true, modality: true } } },
  });

/** Leaderboard slice for the dashboard: lifetime points, only users who have earned some. */
export const activeContributors = (take = 5) =>
  db.userProfile.findMany({
    where: { points: { gt: 0 }, user: { status: "ACTIVE" } },
    orderBy: { points: "desc" },
    take,
    select: { username: true, displayName: true, avatarUrl: true, points: true, designation: true },
  });

export const profileStats = async (userId: string) => {
  const [cases, observations, comments, followers, following] = await Promise.all([
    db.case.count({ where: { authorId: userId, status: "PUBLISHED", deletedAt: null } }),
    db.observation.count({ where: { authorId: userId, deletedAt: null } }),
    db.comment.count({ where: { authorId: userId, deletedAt: null } }),
    db.follow.count({ where: { followingId: userId } }),
    db.follow.count({ where: { followerId: userId } }),
  ]);
  return { cases, observations, comments, followers, following };
};
