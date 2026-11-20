import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { HttpError } from "@/server/http";
import type { ProfileInput } from "@/lib/validation/profile";
import type { Designation } from "@prisma/client";

const PG_YEAR: Partial<Record<Designation, number>> = { PG1: 1, PG2: 2, PG3: 3 };

/** Creates or updates the caller's profile. Institution rows are deduplicated by (name, city). */
export async function upsertProfile(userId: string, input: ProfileInput) {
  const taken = await db.userProfile.findUnique({ where: { username: input.username }, select: { userId: true } });
  if (taken && taken.userId !== userId) {
    throw new HttpError(409, "That username is taken", { username: ["Username is taken"] });
  }

  const profile = await db.$transaction(async (tx) => {
    let institutionId: string | null = null;
    if (input.institutionName) {
      const city = input.institutionCity || null;
      const found = await tx.institution.findFirst({
        where: { name: { equals: input.institutionName, mode: "insensitive" }, city },
      });
      institutionId = (found ?? (await tx.institution.create({ data: { name: input.institutionName, city } }))).id;
    }
    const data = {
      username: input.username,
      displayName: input.displayName,
      designation: input.designation as Designation,
      pgYear: PG_YEAR[input.designation as Designation] ?? null,
      qualification: input.qualification || null,
      yearsExperience: input.yearsExperience ?? null,
      bio: input.bio || null,
      interests: input.interests,
      institutionId,
      onboardingDone: true,
    };
    await tx.user.update({ where: { id: userId }, data: { name: input.displayName } });
    return tx.userProfile.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  });

  await audit({ actorId: userId, action: "profile.update", entity: "UserProfile", entityId: profile.id });
  return profile;
}

export async function submitVerification(userId: string, registrationNo: string, council: string) {
  const open = await db.verificationRequest.findFirst({ where: { userId, status: "PENDING" } });
  if (open) throw new HttpError(409, "A verification request is already pending");
  await db.$transaction([
    db.verificationRequest.create({ data: { userId, registrationNo, council } }),
    db.userProfile.update({ where: { userId }, data: { verificationStatus: "PENDING" } }),
  ]);
  await audit({ actorId: userId, action: "verification.submit", entity: "User", entityId: userId });
}
