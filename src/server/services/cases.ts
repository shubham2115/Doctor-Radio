import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { HttpError } from "@/server/http";
import { storage } from "@/server/storage";
import { scanBuffer, scannerConfigured } from "@/server/upload/scan";
import { processUpload, type Processed } from "@/server/upload/process";
import { LIMITS } from "@/server/upload/sniff";
import { scanTextForPHI } from "@/server/phi";
import { CONSENT_VERSION, caseMetaSchema, submitSchema } from "@/lib/validation/case";
import { award, checkAchievements, touchStreak } from "./points";

type Meta = z.infer<typeof caseMetaSchema>;
const sha = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");

export function assertCanUpload(role: string, verification: string) {
  if (role !== "MEMBER" || verification === "VERIFIED") return;
  throw new HttpError(403, "Only verified doctors can upload cases. Submit your credentials from your profile.");
}

/** Creates a DRAFT case: files are validated, sanitised, scanned and stored privately. Nothing is public yet. */
export async function createDraftCase(userId: string, meta: Meta, files: { name: string; data: Buffer }[]) {
  const phi = scanTextForPHI(meta.title, meta.clinicalHistory, meta.clinicalInfo, meta.imagingFindings, meta.finalDiagnosis);
  if (phi.length) {
    throw new HttpError(422, `Possible patient identifiers detected in the text (${phi.join(", ")}). Remove them and try again.`);
  }

  const warnings: string[] = [];
  const processed: Processed[] = [];
  for (const f of files) {
    const out = await processUpload(f.name, f.data);
    warnings.push(...out.warnings);
    processed.push(...out.processed);
  }
  if (!processed.length) throw new HttpError(422, warnings[0] ?? "No usable files were found in the upload");
  if (processed.length > LIMITS.maxFilesPerCase) throw new HttpError(422, "Too many files in one case");

  // Order DICOM slices by instance number / z-position, then everything else in upload order.
  const order = (p: Processed) => Number(p.dicomMeta?.instanceNumber ?? p.dicomMeta?.zPos ?? 0);
  processed.sort((a, b) => (a.kind === "DICOM" && b.kind === "DICOM" ? order(a) - order(b) : 0));

  const caseId = crypto.randomUUID();
  const stored: string[] = [];
  try {
    const rows: Prisma.CaseFileCreateManyInput[] = [];
    const reports: Prisma.DeidentificationReportCreateManyInput[] = [];
    for (const [i, p] of processed.entries()) {
      const fileId = crypto.randomUUID();
      const key = `cases/${caseId}/${fileId}.${p.ext}`;
      await storage.put(key, p.data, p.mime);
      stored.push(key);
      let thumbKey: string | null = null;
      if (p.thumb) {
        thumbKey = `cases/${caseId}/${fileId}.thumb.jpg`;
        await storage.put(thumbKey, p.thumb, "image/jpeg");
        stored.push(thumbKey);
      }
      rows.push({
        id: fileId, caseId, kind: p.kind, storageKey: key, thumbKey, originalName: p.name, mimeType: p.mime,
        sizeBytes: BigInt(p.data.length), sha256: sha(p.data), position: i, scanStatus: await scanBuffer(p.data),
        dicomMeta: p.dicomMeta as Prisma.InputJsonValue | undefined, sliceCount: p.frames ?? null,
      });
      reports.push({
        caseId, fileId, findings: p.findings as unknown as Prisma.InputJsonValue, burnedInTextSuspected: p.burnedInSuspected,
      });
    }

    const tags = [...new Set(meta.tags)];
    await db.$transaction(async (tx) => {
      await tx.case.create({
        data: {
          id: caseId, authorId: userId, title: meta.title, modality: meta.modality, bodyRegion: meta.bodyRegion,
          category: meta.category, difficulty: meta.difficulty, patientAgeRange: meta.patientAgeRange,
          clinicalHistory: meta.clinicalHistory, clinicalInfo: meta.clinicalInfo || null,
          imagingFindings: meta.imagingFindings || null, finalDiagnosis: meta.finalDiagnosis || null, status: "DRAFT",
        },
      });
      await tx.caseFile.createMany({ data: rows });
      await tx.deidentificationReport.createMany({ data: reports });
      for (const name of tags) {
        const tag = await tx.tag.upsert({ where: { name }, update: {}, create: { name } });
        await tx.caseTag.create({ data: { caseId, tagId: tag.id } });
      }
    });
  } catch (e) {
    await Promise.allSettled(stored.map((k) => storage.delete(k)));
    throw e;
  }
  await audit({ actorId: userId, action: "case.draft_created", entity: "Case", entityId: caseId, metadata: { files: processed.length } });
  return { caseId, warnings };
}

/** Uploader finishes the draft: attestations + chosen files → PENDING_REVIEW. */
export async function submitCase(userId: string, caseId: string, input: z.infer<typeof submitSchema>, ip: string) {
  const c = await db.case.findUnique({ where: { id: caseId }, include: { files: true } });
  if (!c || c.authorId !== userId || c.deletedAt) throw new HttpError(404, "Case not found");
  if (c.status !== "DRAFT" && c.status !== "REJECTED") throw new HttpError(409, "This case has already been submitted");

  const ids = new Set(input.selectedFileIds);
  const chosen = c.files.filter((f) => ids.has(f.id));
  if (!chosen.length) throw new HttpError(422, "Select at least one file to publish");
  if (chosen.some((f) => f.scanStatus === "INFECTED" || f.scanStatus === "REJECTED")) {
    throw new HttpError(422, "A selected file failed the malware scan and cannot be published");
  }

  // Unselected files are securely deleted (object + row) — they never become visible.
  const dropped = c.files.filter((f) => !ids.has(f.id));
  await db.$transaction([
    db.caseFile.deleteMany({ where: { id: { in: dropped.map((f) => f.id) } } }),
    db.caseFile.updateMany({ where: { id: { in: chosen.map((f) => f.id) } }, data: { selected: true } }),
    db.case.update({
      where: { id: caseId },
      data: {
        status: "PENDING_REVIEW", rejectionReason: null, deidConfirmedAt: new Date(),
        authorizationConfirmedAt: new Date(), consentTextVersion: CONSENT_VERSION,
      },
    }),
  ]);
  await Promise.allSettled(dropped.flatMap((f) => [storage.delete(f.storageKey), f.thumbKey ? storage.delete(f.thumbKey) : Promise.resolve()]));
  await audit({ actorId: userId, action: "case.submitted", entity: "Case", entityId: caseId, ip, metadata: { consent: CONSENT_VERSION, files: chosen.length } });
}

export async function reviewCase(moderatorId: string, caseId: string, decision: "approve" | "reject", reason: string | undefined, ip: string) {
  const c = await db.case.findUnique({ where: { id: caseId }, include: { files: { select: { scanStatus: true } } } });
  if (!c || c.status !== "PENDING_REVIEW") throw new HttpError(409, "Case is not awaiting review");

  if (decision === "approve") {
    if (!c.deidConfirmedAt || !c.authorizationConfirmedAt) throw new HttpError(409, "Uploader attestations are missing");
    if (c.files.some((f) => f.scanStatus === "INFECTED")) throw new HttpError(409, "Case contains an infected file");
    const unscanned = c.files.some((f) => f.scanStatus === "PENDING");
    if (unscanned && process.env.ALLOW_UNSCANNED !== "true") {
      throw new HttpError(409, scannerConfigured() ? "Malware scan has not completed" : "No malware scanner configured (set CLAMAV_HOST)");
    }
  } else if (!reason?.trim()) throw new HttpError(422, "Provide a reason for rejection");

  await db.$transaction(async (tx) => {
    if (decision === "approve") {
      await tx.case.update({ where: { id: caseId }, data: { status: "PUBLISHED", publishedAt: new Date(), reviewedById: moderatorId, reviewedAt: new Date() } });
      await award(tx, c.authorId, "case_published", caseId);
      await touchStreak(tx, c.authorId);
      await checkAchievements(tx, c.authorId);
    } else {
      await tx.case.update({ where: { id: caseId }, data: { status: "REJECTED", rejectionReason: reason!.trim(), reviewedById: moderatorId, reviewedAt: new Date() } });
    }
    await tx.moderationAction.create({
      data: { moderatorId, type: decision === "approve" ? "APPROVE_CASE" : "REJECT_CASE", targetType: "Case", targetId: caseId, reason },
    });
    await tx.notification.create({
      data: {
        recipientId: c.authorId, actorId: moderatorId, caseId, type: decision === "approve" ? "CASE_APPROVED" : "CASE_REJECTED",
        message: decision === "approve" ? `approved your case “${c.title}”` : `returned your case “${c.title}”: ${reason}`,
      },
    });
  });
  await audit({ actorId: moderatorId, action: `case.${decision}`, entity: "Case", entityId: caseId, ip });
}

export async function deleteDraft(userId: string, caseId: string) {
  const c = await db.case.findUnique({ where: { id: caseId }, include: { files: true } });
  if (!c || c.authorId !== userId) throw new HttpError(404, "Case not found");
  if (c.status === "PUBLISHED") throw new HttpError(409, "Published cases must be removed through moderation");
  await db.case.delete({ where: { id: caseId } });
  await Promise.allSettled(c.files.flatMap((f) => [storage.delete(f.storageKey), f.thumbKey ? storage.delete(f.thumbKey) : Promise.resolve()]));
  await audit({ actorId: userId, action: "case.deleted", entity: "Case", entityId: caseId });
}
