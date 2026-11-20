import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { HttpError } from "@/server/http";
import { scanTextForPHI } from "@/server/phi";
import type { ObservationInput } from "@/lib/validation/engagement";
import { award, checkAchievements, touchStreak } from "./points";

/** Interactions are only allowed on published, non-deleted cases. */
async function publishedCase(caseId: string) {
  const c = await db.case.findUnique({ where: { id: caseId }, select: { id: true, authorId: true, status: true, deletedAt: true, title: true } });
  if (!c || c.deletedAt || c.status !== "PUBLISHED") throw new HttpError(404, "Case not found");
  return c;
}

// ───────────── likes & bookmarks (idempotent; counters change in the same transaction) ─────────────

export async function setCaseLike(userId: string, caseId: string, on: boolean) {
  await publishedCase(caseId);
  await db.$transaction(async (tx) => {
    const existing = await tx.like.findUnique({ where: { userId_caseId: { userId, caseId } } });
    if (on && !existing) {
      await tx.like.create({ data: { userId, caseId } });
      await tx.case.update({ where: { id: caseId }, data: { likeCount: { increment: 1 } } });
    } else if (!on && existing) {
      await tx.like.delete({ where: { id: existing.id } });
      await tx.case.update({ where: { id: caseId }, data: { likeCount: { decrement: 1 } } });
    }
  });
}

export async function setBookmark(userId: string, caseId: string, on: boolean) {
  await publishedCase(caseId);
  await db.$transaction(async (tx) => {
    const existing = await tx.bookmark.findUnique({ where: { userId_caseId: { userId, caseId } } });
    if (on && !existing) {
      await tx.bookmark.create({ data: { userId, caseId } });
      await tx.case.update({ where: { id: caseId }, data: { bookmarkCount: { increment: 1 } } });
    } else if (!on && existing) {
      await tx.bookmark.delete({ where: { userId_caseId: { userId, caseId } } });
      await tx.case.update({ where: { id: caseId }, data: { bookmarkCount: { decrement: 1 } } });
    }
  });
}

export async function setCommentLike(userId: string, commentId: string, on: boolean) {
  const c = await db.comment.findUnique({ where: { id: commentId }, select: { id: true, deletedAt: true, case: { select: { status: true } } } });
  if (!c || c.deletedAt || c.case.status !== "PUBLISHED") throw new HttpError(404, "Comment not found");
  await db.$transaction(async (tx) => {
    const existing = await tx.like.findUnique({ where: { userId_commentId: { userId, commentId } } });
    if (on && !existing) {
      await tx.like.create({ data: { userId, commentId } });
      await tx.comment.update({ where: { id: commentId }, data: { likeCount: { increment: 1 } } });
    } else if (!on && existing) {
      await tx.like.delete({ where: { id: existing.id } });
      await tx.comment.update({ where: { id: commentId }, data: { likeCount: { decrement: 1 } } });
    }
  });
}

// ───────────── reveal mode ─────────────

export async function revealObservations(userId: string, caseId: string, skip: boolean) {
  await publishedCase(caseId);
  if (skip) {
    await db.observationReveal.upsert({ where: { userId_caseId: { userId, caseId } }, create: { userId, caseId, skipped: true }, update: {} });
    return;
  }
  // Non-skip reveal is only available after the user has submitted their own independent read.
  const mine = await db.observation.findUnique({ where: { caseId_authorId: { caseId, authorId: userId } }, select: { id: true, deletedAt: true } });
  if (!mine || mine.deletedAt) throw new HttpError(409, "Submit your own observation first, or choose to skip");
  await db.observationReveal.upsert({ where: { userId_caseId: { userId, caseId } }, create: { userId, caseId }, update: {} });
}

// ───────────── observations ─────────────

export async function upsertObservation(userId: string, caseId: string, input: ObservationInput) {
  const c = await publishedCase(caseId);
  const phi = scanTextForPHI(input.findings, input.impression, input.comments);
  if (phi.length) throw new HttpError(422, `Possible patient identifiers detected (${phi.join(", ")}). Please remove them.`);

  return db.$transaction(async (tx) => {
    const existing = await tx.observation.findUnique({ where: { caseId_authorId: { caseId, authorId: userId } } });
    const data = {
      findings: input.findings, impression: input.impression || null, comments: input.comments || null,
      references: input.references || null, imagingSigns: input.imagingSigns, confidence: input.confidence ?? null,
    };
    let id: string;
    if (existing) {
      await tx.observation.update({ where: { id: existing.id }, data: { ...data, deletedAt: null, editedAt: new Date() } });
      await tx.differentialDiagnosis.deleteMany({ where: { observationId: existing.id } });
      id = existing.id;
      if (existing.deletedAt) await tx.case.update({ where: { id: caseId }, data: { observationCount: { increment: 1 } } });
    } else {
      id = (await tx.observation.create({ data: { caseId, authorId: userId, ...data } })).id;
      await tx.case.update({ where: { id: caseId }, data: { observationCount: { increment: 1 }, lastActivityAt: new Date() } });
      await award(tx, userId, "observation", id);
      if (c.authorId !== userId) {
        await tx.notification.create({ data: { recipientId: c.authorId, actorId: userId, caseId, type: "NEW_OBSERVATION", message: `submitted an observation on “${c.title}”` } });
      }
    }
    if (input.differentials.length) {
      await tx.differentialDiagnosis.createMany({
        data: input.differentials.map((d, rank) => ({ observationId: id, diagnosis: d.diagnosis, rationale: d.rationale || null, rank })),
      });
    }
    // Submitting an observation counts as a learning day and also unlocks reveal.
    await touchStreak(tx, userId);
    await checkAchievements(tx, userId);
    return { id };
  });
}

export async function deleteObservation(userId: string, caseId: string) {
  const o = await db.observation.findUnique({ where: { caseId_authorId: { caseId, authorId: userId } } });
  if (!o || o.deletedAt) throw new HttpError(404, "Observation not found");
  await db.$transaction([
    db.observation.update({ where: { id: o.id }, data: { deletedAt: new Date() } }),
    db.case.update({ where: { id: caseId }, data: { observationCount: { decrement: 1 } } }),
  ]);
}

/** Peer-rated usefulness. You can't rate your own work; the case author's marks count like anyone's. */
export async function setHelpful(userId: string, observationId: string, on: boolean) {
  const o = await db.observation.findUnique({ where: { id: observationId }, select: { id: true, authorId: true, deletedAt: true, case: { select: { status: true } } } });
  if (!o || o.deletedAt || o.case.status !== "PUBLISHED") throw new HttpError(404, "Observation not found");
  if (o.authorId === userId) throw new HttpError(400, "You can't mark your own observation helpful");
  await db.$transaction(async (tx) => {
    const key = { observationId_userId: { observationId, userId } };
    const existing = await tx.observationHelpful.findUnique({ where: key });
    if (on && !existing) {
      await tx.observationHelpful.create({ data: { observationId, userId } });
      await award(tx, o.authorId, "helpful_received", `${observationId}:${userId}`);
      await checkAchievements(tx, o.authorId);
    } else if (!on && existing) {
      await tx.observationHelpful.delete({ where: key });
    }
  });
}

// ───────────── comments ─────────────

const MENTION = /(^|\s)@([a-z0-9_]{3,30})\b/g;

export async function createComment(userId: string, caseId: string, body: string, parentId?: string, observationId?: string) {
  const c = await publishedCase(caseId);
  let parentAuthor: string | null = null;
  if (parentId) {
    const p = await db.comment.findUnique({ where: { id: parentId } });
    if (!p || p.deletedAt || p.caseId !== caseId) throw new HttpError(404, "Parent comment not found");
    parentAuthor = p.authorId;
    observationId = p.observationId ?? undefined; // replies stay in their parent's thread
  }
  if (observationId) {
    const o = await db.observation.findUnique({ where: { id: observationId }, select: { caseId: true, authorId: true, deletedAt: true } });
    if (!o || o.deletedAt || o.caseId !== caseId) throw new HttpError(404, "Observation not found");
    parentAuthor ??= o.authorId;
  }
  const mentioned = [...new Set([...body.matchAll(MENTION)].map((m) => m[2]))];

  const comment = await db.$transaction(async (tx) => {
    const created = await tx.comment.create({ data: { caseId, authorId: userId, body, parentId, observationId } });
    await tx.case.update({ where: { id: caseId }, data: { commentCount: { increment: 1 }, lastActivityAt: new Date() } });
    const notified = new Set<string>([userId]);
    const notify = async (recipientId: string, type: "REPLY" | "MENTION", message: string) => {
      if (notified.has(recipientId)) return;
      notified.add(recipientId);
      await tx.notification.create({ data: { recipientId, actorId: userId, caseId, commentId: created.id, type, message } });
    };
    if (mentioned.length) {
      const users = await tx.userProfile.findMany({ where: { username: { in: mentioned } }, select: { userId: true } });
      for (const u of users) await notify(u.userId, "MENTION", `mentioned you in “${c.title}”`);
    }
    if (parentAuthor) await notify(parentAuthor, "REPLY", `replied to you in “${c.title}”`);
    else await notify(c.authorId, "REPLY", `commented on your case “${c.title}”`);
    await touchStreak(tx, userId);
    return created;
  });
  return comment;
}

export async function editComment(userId: string, commentId: string, body: string) {
  const c = await db.comment.findUnique({ where: { id: commentId } });
  if (!c || c.deletedAt || c.authorId !== userId) throw new HttpError(404, "Comment not found");
  await db.comment.update({ where: { id: commentId }, data: { body, editedAt: new Date() } });
}

export async function deleteComment(user: { id: string; role: string }, commentId: string) {
  const c = await db.comment.findUnique({ where: { id: commentId } });
  if (!c || c.deletedAt) throw new HttpError(404, "Comment not found");
  if (c.authorId !== user.id && user.role === "MEMBER") throw new HttpError(403, "Forbidden");
  await db.$transaction([
    db.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } }),
    db.case.update({ where: { id: c.caseId }, data: { commentCount: { decrement: 1 } } }),
  ]);
  if (c.authorId !== user.id) await audit({ actorId: user.id, action: "comment.removed", entity: "Comment", entityId: commentId });
}

// ───────────── reports ─────────────

export async function fileReport(userId: string, targetType: "CASE" | "COMMENT" | "OBSERVATION", targetId: string, reason: string, details?: string) {
  const exists =
    targetType === "CASE" ? await db.case.findUnique({ where: { id: targetId }, select: { id: true } })
    : targetType === "COMMENT" ? await db.comment.findUnique({ where: { id: targetId }, select: { id: true } })
    : await db.observation.findUnique({ where: { id: targetId }, select: { id: true } });
  if (!exists) throw new HttpError(404, "Content not found");
  await db.report.upsert({
    where: { reporterId_targetType_targetId: { reporterId: userId, targetType, targetId } },
    create: { reporterId: userId, targetType, targetId, reason, details: details || null },
    update: {},
  });
}
