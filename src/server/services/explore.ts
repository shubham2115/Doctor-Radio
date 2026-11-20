import type { Difficulty, Modality, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/server/db";
import { BODY_REGIONS, CASE_CATEGORIES, DIFFICULTIES, MODALITIES } from "@/lib/validation/case";
import { caseCardSelect, toCardView } from "./dashboard";

export const exploreQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  modality: z.enum(MODALITIES).optional(),
  region: z.enum(BODY_REGIONS).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  category: z.enum(CASE_CATEGORIES).optional(),
  date: z.enum(["7d", "30d", "90d", "365d"]).optional(),
  sort: z.enum(["new", "trending", "awaiting"]).default("new"),
  cursor: z.string().max(60).optional(),
});
export type ExploreQuery = z.infer<typeof exploreQuerySchema>;

const STOP = new Set("show me find cases case with involving of the a an in on and for to that has have having any some all about related regarding please".split(" "));
const MODALITY_WORDS: Record<string, Modality> = {
  mri: "MRI", mr: "MRI", ct: "CT", xray: "XRAY", radiograph: "XRAY", ultrasound: "ULTRASOUND", usg: "ULTRASOUND",
  sonography: "ULTRASOUND", mammography: "MAMMOGRAPHY", mammogram: "MAMMOGRAPHY", pet: "PET_CT", petct: "PET_CT",
};

/**
 * Natural-language-ish keyword search: "show me MRI brain cases involving ring-enhancing lesions"
 * → modality=MRI plus AND over [brain, ring, enhancing, lesion] across text fields and tags.
 * The same entry point will be backed by pgvector embeddings in a later phase.
 */
function parseSearch(q: string) {
  const raw = q.toLowerCase().replace(/x-ray/g, "xray").replace(/pet-ct/g, "petct");
  const words = raw.split(/[^a-z0-9]+/).filter(Boolean);
  let modality: Modality | undefined;
  const terms: string[] = [];
  for (const w of words) {
    if (MODALITY_WORDS[w]) modality ??= MODALITY_WORDS[w];
    else if (!STOP.has(w) && w.length > 1) terms.push(w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w);
  }
  return { modality, terms: [...new Set(terms)].slice(0, 8) };
}

const PAGE = 12;

export async function searchCases(query: ExploreQuery) {
  const and: Prisma.CaseWhereInput[] = [{ status: "PUBLISHED", deletedAt: null }];
  let modality: Modality | undefined = query.modality;

  if (query.q) {
    const parsed = parseSearch(query.q);
    modality ??= parsed.modality;
    for (const t of parsed.terms) {
      const c = { contains: t, mode: "insensitive" as const };
      and.push({
        OR: [
          { title: c }, { clinicalHistory: c }, { clinicalInfo: c }, { imagingFindings: c },
          { bodyRegion: c }, { category: c }, { tags: { some: { tag: { name: c } } } },
        ],
      });
    }
  }
  if (modality) and.push({ modality });
  if (query.region) and.push({ bodyRegion: query.region });
  if (query.difficulty) and.push({ difficulty: query.difficulty as Difficulty });
  if (query.category) and.push({ category: query.category });
  if (query.date) and.push({ publishedAt: { gte: new Date(Date.now() - parseInt(query.date) * 86400_000) } });
  if (query.sort === "awaiting") and.push({ observationCount: 0 });

  const orderBy: Prisma.CaseOrderByWithRelationInput[] =
    query.sort === "trending"
      ? [{ commentCount: "desc" }, { likeCount: "desc" }, { observationCount: "desc" }, { id: "asc" }]
      : [{ publishedAt: "desc" }, { id: "asc" }];

  const rows = await db.case.findMany({
    where: { AND: and },
    orderBy,
    take: PAGE + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    select: caseCardSelect,
  });
  const hasMore = rows.length > PAGE;
  const page = rows.slice(0, PAGE);
  return { items: page.map(toCardView), nextCursor: hasMore ? page[page.length - 1].id : null };
}
