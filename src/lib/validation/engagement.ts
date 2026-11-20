import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);

export const observationSchema = z.object({
  findings: text(5000).min(10, "Describe your findings"),
  impression: text(2000).optional().or(z.literal("")),
  comments: text(3000).optional().or(z.literal("")),
  references: text(2000).optional().or(z.literal("")),
  imagingSigns: z.array(text(60).min(2)).max(10).default([]),
  confidence: z.enum(["LOW", "MODERATE", "HIGH"]).optional(),
  differentials: z
    .array(z.object({ diagnosis: text(160).min(2), rationale: text(1000).optional().or(z.literal("")) }))
    .max(8)
    .default([]),
});

export const commentSchema = z.object({
  body: text(4000).min(1, "Write something first"),
  parentId: z.string().min(1).optional(),
  observationId: z.string().min(1).optional(),
});

export const revealSchema = z.object({ skip: z.boolean().default(false) });

export const reportSchema = z.object({
  targetType: z.enum(["CASE", "COMMENT", "OBSERVATION"]),
  targetId: z.string().min(1),
  reason: z.enum(["Patient identifiable information", "Inappropriate content", "Incorrect or misleading", "Spam", "Other"]),
  details: text(1000).optional().or(z.literal("")),
});

export type ObservationInput = z.infer<typeof observationSchema>;
