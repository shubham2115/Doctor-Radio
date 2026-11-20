import { NextResponse } from "next/server";
import { apiUser } from "@/server/dal";
import { db } from "@/server/db";
import { assertSameOrigin, HttpError, limit, route } from "@/server/http";
import { caseMetaSchema } from "@/lib/validation/case";
import { assertCanUpload, createDraftCase } from "@/server/services/cases";
import { LIMITS } from "@/server/upload/sniff";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 300;

export const POST = route(async (req) => {
  assertSameOrigin(req);
  const user = await apiUser();
  await limit(req, "case-upload", 20, 60 * 60);

  const profile = await db.userProfile.findUnique({ where: { userId: user.id }, select: { verificationStatus: true } });
  if (!profile) throw new HttpError(403, "Complete your profile first");
  assertCanUpload(user.role, profile.verificationStatus);

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > LIMITS.maxTotalBytes + 1024 * 1024) throw new HttpError(413, "Upload is too large");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, "Malformed upload");
  }

  const rawMeta = form.get("meta");
  if (typeof rawMeta !== "string") throw new HttpError(400, "Missing case details");
  let metaJson: unknown;
  try {
    metaJson = JSON.parse(rawMeta);
  } catch {
    throw new HttpError(400, "Invalid case details");
  }
  const parsed = caseMetaSchema.safeParse(metaJson);
  if (!parsed.success) throw new HttpError(422, "Validation failed", z.flattenError(parsed.error).fieldErrors as Record<string, string[]>);

  const uploads = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!uploads.length) throw new HttpError(422, "Add at least one image, PDF, DICOM or archive");
  if (uploads.length > LIMITS.maxFilesPerUpload) throw new HttpError(422, `At most ${LIMITS.maxFilesPerUpload} files per upload`);
  let total = 0;
  for (const f of uploads) {
    total += f.size;
    if (f.size > LIMITS.maxFileBytes) throw new HttpError(413, `${f.name} exceeds the ${LIMITS.maxFileBytes / 1024 / 1024} MB per-file limit`);
  }
  if (total > LIMITS.maxTotalBytes) throw new HttpError(413, "Total upload size exceeds the limit");

  const files = await Promise.all(uploads.map(async (f) => ({ name: f.name, data: Buffer.from(await f.arrayBuffer()) })));
  const { caseId, warnings } = await createDraftCase(user.id, parsed.data, files);
  return NextResponse.json({ caseId, warnings }, { status: 201 });
});
