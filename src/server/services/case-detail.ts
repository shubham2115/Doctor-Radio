import type { ConfidenceLevel, Difficulty, Modality, CaseStatus } from "@prisma/client";
import { db } from "@/server/db";
import { signedFileUrl } from "@/server/signing";
import type { ViewerItem } from "@/components/cases/viewer";

export type ObsView = {
  id: string; authorName: string; authorUsername: string | null; authorAvatar: string | null; authorDesignation: string | null;
  createdAt: Date; editedAt: Date | null; findings: string; impression: string | null; comments: string | null; references: string | null;
  imagingSigns: string[]; confidence: ConfidenceLevel | null; differentials: { diagnosis: string; rationale: string | null }[];
  helpfulCount: number; helpedByMe: boolean; mine: boolean;
};

export type CommentView = {
  id: string; parentId: string | null; observationId: string | null; authorName: string; authorUsername: string | null;
  authorAvatar: string | null; body: string; createdAt: Date; editedAt: Date | null; likeCount: number; likedByMe: boolean; mine: boolean;
};

export type CaseDetail = {
  id: string; title: string; modality: Modality; bodyRegion: string; category: string | null; difficulty: Difficulty; status: CaseStatus;
  ageRange: string | null; clinicalHistory: string; clinicalInfo: string | null; imagingFindings: string | null; tags: string[];
  publishedAt: Date | null; rejectionReason: string | null; finalDiagnosis: string | null;
  author: { name: string; username: string | null; avatar: string | null; designation: string | null };
  counts: { likes: number; comments: number; observations: number; bookmarks: number };
  viewer: { id: string; isAuthor: boolean; isStaff: boolean; liked: boolean; bookmarked: boolean; unlocked: boolean; hasObserved: boolean };
  files: ViewerItem[];
  observations: ObsView[]; // others' observations — empty while locked
  myObservation: ObsView | null;
  lockedObservationCount: number;
  comments: CommentView[]; // empty while locked
  deid: { file: string; findings: { name: string; action: string }[]; burnedIn: boolean }[];
};

export async function getCaseDetail(caseId: string, viewer: { id: string; role: string }): Promise<CaseDetail | null> {
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: {
      author: { select: { profile: { select: { displayName: true, username: true, avatarUrl: true, designation: true } } } },
      files: { orderBy: { position: "asc" }, where: { selected: true } },
      tags: { include: { tag: true } },
    },
  });
  if (!c || c.deletedAt) return null;
  const isStaff = viewer.role !== "MEMBER";
  const isAuthor = c.authorId === viewer.id;
  if (c.status !== "PUBLISHED" && !isAuthor && !isStaff) return null;

  const [like, bookmark, reveal] = await Promise.all([
    db.like.findUnique({ where: { userId_caseId: { userId: viewer.id, caseId } }, select: { id: true } }),
    db.bookmark.findUnique({ where: { userId_caseId: { userId: viewer.id, caseId } }, select: { caseId: true } }),
    db.observationReveal.findUnique({ where: { userId_caseId: { userId: viewer.id, caseId } }, select: { userId: true } }),
  ]);
  // Reveal mode: others' reads (and discussion) unlock after the viewer reveals, skips, or if they are author/staff.
  const unlocked = isAuthor || isStaff || Boolean(reveal);

  const obsRows = await db.observation.findMany({
    where: { caseId, deletedAt: null, ...(unlocked ? {} : { authorId: viewer.id }) },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { profile: { select: { displayName: true, username: true, avatarUrl: true, designation: true } } } },
      differentials: { orderBy: { rank: "asc" } },
      helpful: { select: { userId: true } },
    },
  });
  const toObs = (o: (typeof obsRows)[number]): ObsView => ({
    id: o.id, authorName: o.author.profile?.displayName ?? "Member", authorUsername: o.author.profile?.username ?? null,
    authorAvatar: o.author.profile?.avatarUrl ?? null, authorDesignation: o.author.profile?.designation ?? null,
    createdAt: o.createdAt, editedAt: o.editedAt, findings: o.findings, impression: o.impression, comments: o.comments,
    references: o.references, imagingSigns: o.imagingSigns, confidence: o.confidence,
    differentials: o.differentials.map((d) => ({ diagnosis: d.diagnosis, rationale: d.rationale })),
    helpfulCount: o.helpful.length, helpedByMe: o.helpful.some((h) => h.userId === viewer.id), mine: o.authorId === viewer.id,
  });
  const all = obsRows.map(toObs);
  const myObservation = all.find((o) => o.mine) ?? null;

  const commentRows = unlocked
    ? await db.comment.findMany({
        where: { caseId, deletedAt: null }, orderBy: { createdAt: "asc" }, take: 500,
        include: { author: { select: { profile: { select: { displayName: true, username: true, avatarUrl: true } } } }, likes: { where: { userId: viewer.id }, select: { id: true } } },
      })
    : [];

  const reports = isAuthor || isStaff ? await db.deidentificationReport.findMany({ where: { caseId } }) : [];
  const nameOf = new Map(c.files.map((f) => [f.id, f.originalName]));

  return {
    id: c.id, title: c.title, modality: c.modality, bodyRegion: c.bodyRegion, category: c.category, difficulty: c.difficulty, status: c.status,
    ageRange: c.patientAgeRange, clinicalHistory: c.clinicalHistory, clinicalInfo: c.clinicalInfo, imagingFindings: c.imagingFindings,
    tags: c.tags.map((t) => t.tag.name), publishedAt: c.publishedAt, rejectionReason: c.rejectionReason,
    finalDiagnosis: isAuthor || isStaff ? c.finalDiagnosis : null,
    author: { name: c.author.profile?.displayName ?? "Member", username: c.author.profile?.username ?? null, avatar: c.author.profile?.avatarUrl ?? null, designation: c.author.profile?.designation ?? null },
    counts: { likes: c.likeCount, comments: c.commentCount, observations: c.observationCount, bookmarks: c.bookmarkCount },
    viewer: { id: viewer.id, isAuthor, isStaff, liked: Boolean(like), bookmarked: Boolean(bookmark), unlocked, hasObserved: Boolean(myObservation) },
    files: c.files.map((f) => ({
      id: f.id, kind: f.kind === "ARCHIVE" ? "IMAGE" : f.kind, name: f.originalName, url: signedFileUrl(f.id), thumbUrl: f.thumbKey ? signedFileUrl(f.id, "thumb") : null,
      frames: f.sliceCount ?? 1, meta: (f.dicomMeta as ViewerItem["meta"]) ?? null,
    })),
    observations: all.filter((o) => !o.mine),
    myObservation,
    lockedObservationCount: unlocked ? 0 : Math.max(0, c.observationCount - (myObservation ? 1 : 0)),
    comments: commentRows.map((m) => ({
      id: m.id, parentId: m.parentId, observationId: m.observationId, authorName: m.author.profile?.displayName ?? "Member",
      authorUsername: m.author.profile?.username ?? null, authorAvatar: m.author.profile?.avatarUrl ?? null, body: m.body,
      createdAt: m.createdAt, editedAt: m.editedAt, likeCount: m.likeCount, likedByMe: m.likes.length > 0, mine: m.authorId === viewer.id,
    })),
    deid: reports.map((r) => ({ file: (r.fileId && nameOf.get(r.fileId)) || "file", findings: r.findings as { name: string; action: string }[], burnedIn: r.burnedInTextSuspected })),
  };
}
