import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Points are quality-weighted: a few for taking part, more when peers find work helpful.
 * Each (user, reason, ref) can only be awarded once, and `observation` points are capped per day so
 * volume can't be farmed. Nothing here rewards diagnostic certainty.
 */
const POINTS = { observation: 5, case_published: 20, helpful_received: 4, comment_helpful: 0 } as const;
const DAILY_CAP: Partial<Record<keyof typeof POINTS, number>> = { observation: 25 };

const ACHIEVEMENTS = [
  { key: "first-observation", name: "First read", description: "Submitted your first independent observation", icon: "eye" },
  { key: "first-case", name: "Contributor", description: "Had a case published", icon: "upload" },
  { key: "helpful-5", name: "Helpful reader", description: "Received 5 'helpful' marks from peers", icon: "heart" },
  { key: "streak-7", name: "Seven-day streak", description: "Learned something 7 days in a row", icon: "flame" },
];

async function grant(tx: Tx, userId: string, key: string) {
  const a = await tx.achievement.upsert({ where: { key }, update: {}, create: ACHIEVEMENTS.find((x) => x.key === key)! });
  const has = await tx.userAchievement.findUnique({ where: { userId_achievementId: { userId, achievementId: a.id } } });
  if (has) return;
  await tx.userAchievement.create({ data: { userId, achievementId: a.id } });
  await tx.notification.create({ data: { recipientId: userId, type: "ACHIEVEMENT", message: `earned the “${a.name}” badge` } });
}

export async function award(tx: Tx, userId: string, reason: keyof typeof POINTS, refId: string) {
  const points = POINTS[reason];
  if (!points) return;
  const reasonKey = `${reason}`;
  const dup = await tx.pointEvent.findFirst({ where: { userId, reason: reasonKey, refId } });
  if (dup) return;
  const cap = DAILY_CAP[reason];
  if (cap) {
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const today = await tx.pointEvent.aggregate({ where: { userId, reason: reasonKey, createdAt: { gte: since } }, _sum: { points: true } });
    if ((today._sum.points ?? 0) >= cap) return;
  }
  await tx.pointEvent.create({ data: { userId, reason: reasonKey, points, refId } });
  await tx.userProfile.update({ where: { userId }, data: { points: { increment: points } } });
}

/** Learning streak: consecutive calendar days with a qualifying activity. */
export async function touchStreak(tx: Tx, userId: string) {
  const p = await tx.userProfile.findUnique({ where: { userId }, select: { lastActiveOn: true, streakDays: true } });
  if (!p) return;
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const last = p.lastActiveOn ? new Date(p.lastActiveOn) : null;
  if (last && last.getTime() === today.getTime()) return;
  const yesterday = new Date(today.getTime() - 86400_000);
  const streak = last && last.getTime() === yesterday.getTime() ? p.streakDays + 1 : 1;
  await tx.userProfile.update({ where: { userId }, data: { streakDays: streak, lastActiveOn: today } });
  if (streak >= 7) await grant(tx, userId, "streak-7");
}

export async function checkAchievements(tx: Tx, userId: string) {
  const [obs, cases, helpful] = await Promise.all([
    tx.observation.count({ where: { authorId: userId, deletedAt: null } }),
    tx.case.count({ where: { authorId: userId, status: "PUBLISHED" } }),
    tx.observationHelpful.count({ where: { observation: { authorId: userId } } }),
  ]);
  if (obs >= 1) await grant(tx, userId, "first-observation");
  if (cases >= 1) await grant(tx, userId, "first-case");
  if (helpful >= 5) await grant(tx, userId, "helpful-5");
}
