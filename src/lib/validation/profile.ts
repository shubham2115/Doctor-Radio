import { z } from "zod";

export const DESIGNATIONS = [
  { value: "STUDENT", label: "Medical student" },
  { value: "PG1", label: "Resident — PG1" },
  { value: "PG2", label: "Resident — PG2" },
  { value: "PG3", label: "Resident — PG3" },
  { value: "FELLOW", label: "Fellow" },
  { value: "CONSULTANT", label: "Consultant radiologist" },
  { value: "FACULTY", label: "Professor / teaching faculty" },
] as const;

export const INTEREST_OPTIONS = [
  "Neuroradiology", "Head & Neck", "Chest / Thoracic", "Cardiac", "Abdominal / GI", "Genitourinary",
  "Musculoskeletal", "Breast", "Pediatric", "Vascular & Interventional", "Obstetric & Fetal", "Nuclear / PET",
  "Emergency / Trauma", "Oncologic imaging",
] as const;

const designationValues = DESIGNATIONS.map((d) => d.value) as [string, ...string[]];

export const profileSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "At least 3 characters")
    .max(30)
    .regex(/^[a-z0-9_]+$/, "Letters, numbers and underscores only"),
  displayName: z.string().trim().min(2).max(80),
  designation: z.enum(designationValues),
  qualification: z.string().trim().max(120).optional().or(z.literal("")),
  institutionName: z.string().trim().max(160).optional().or(z.literal("")),
  institutionCity: z.string().trim().max(80).optional().or(z.literal("")),
  yearsExperience: z.coerce.number().int().min(0).max(60).optional(),
  bio: z.string().trim().max(600).optional().or(z.literal("")),
  interests: z.array(z.enum(INTEREST_OPTIONS)).max(8),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const verificationSchema = z.object({
  registrationNo: z.string().trim().min(3).max(60),
  council: z.string().trim().min(2).max(120),
});
