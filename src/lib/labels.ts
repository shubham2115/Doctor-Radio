import type { Difficulty, Modality } from "@prisma/client";

export const MODALITY_LABEL: Record<Modality, string> = {
  CT: "CT",
  MRI: "MRI",
  XRAY: "X-ray",
  ULTRASOUND: "Ultrasound",
  MAMMOGRAPHY: "Mammography",
  PET_CT: "PET-CT",
  OTHER: "Other",
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

export const DIFFICULTY_TONE: Record<Difficulty, "success" | "warning" | "danger"> = {
  BEGINNER: "success",
  INTERMEDIATE: "warning",
  ADVANCED: "danger",
};
