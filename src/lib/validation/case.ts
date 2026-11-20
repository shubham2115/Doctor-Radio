import { z } from "zod";

export const MODALITIES = ["CT", "MRI", "XRAY", "ULTRASOUND", "MAMMOGRAPHY", "PET_CT", "OTHER"] as const;
export const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;

export const BODY_REGIONS = [
  "Brain", "Head & Neck", "Spine", "Chest", "Cardiac", "Abdomen", "Pelvis", "Breast", "Musculoskeletal",
  "Vascular", "Pediatric", "Obstetric", "Whole body",
] as const;

export const CASE_CATEGORIES = [
  "Neoplasm", "Infection / Inflammation", "Trauma", "Vascular", "Congenital", "Degenerative", "Metabolic",
  "Post-procedural", "Normal variant", "Other",
] as const;

export const AGE_RANGES = ["Neonate", "0-1 y", "1-10 y", "10-18 y", "18-30 y", "30-45 y", "45-60 y", "60-75 y", "75+ y"] as const;

const optional = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const caseMetaSchema = z.object({
  title: z.string().trim().min(5, "Give the case a descriptive title").max(160),
  modality: z.enum(MODALITIES),
  bodyRegion: z.enum(BODY_REGIONS),
  category: z.enum(CASE_CATEGORIES).optional(),
  difficulty: z.enum(DIFFICULTIES),
  patientAgeRange: z.enum(AGE_RANGES).optional(),
  clinicalHistory: z.string().trim().min(10, "Add a short clinical history").max(4000),
  clinicalInfo: optional(4000),
  imagingFindings: optional(4000),
  finalDiagnosis: optional(300),
  tags: z.array(z.string().trim().toLowerCase().min(2).max(30)).max(10),
});

export const submitSchema = z.object({
  deidentified: z.literal(true, { error: "You must confirm the case is de-identified" }),
  authorized: z.literal(true, { error: "You must confirm you are authorised to share this case" }),
  noBurnedInText: z.literal(true, { error: "You must confirm images contain no identifying text" }),
  selectedFileIds: z.array(z.string().min(1)).min(1, "Select at least one file to publish").max(400),
});

export const CONSENT_VERSION = "2026-11-v1";
