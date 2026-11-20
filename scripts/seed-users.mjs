// Creates (or resets) a demo admin and a demo member for LOCAL DEVELOPMENT ONLY.
// Usage: npm run seed-users
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed demo accounts in production.");
  process.exit(1);
}

const ACCOUNTS = [
  { email: "admin@doctorradio.local", name: "Dr. Admin", username: "admin", password: "Admin@Radio2026", role: "ADMIN", designation: "FACULTY", qualification: "MD Radiodiagnosis" },
  { email: "user@doctorradio.local", name: "Dr. Demo User", username: "demo_user", password: "User@Radio2026", role: "MEMBER", designation: "PG2", qualification: "MD Radiodiagnosis (resident)" },
];

const db = new PrismaClient();
try {
  const inst = (await db.institution.findFirst({ where: { name: "Demo Institute of Medical Sciences" } })) ?? (await db.institution.create({ data: { name: "Demo Institute of Medical Sciences", city: "New Delhi" } }));
  for (const a of ACCOUNTS) {
    const passwordHash = await bcrypt.hash(a.password, 12);
    const user = await db.user.upsert({
      where: { email: a.email },
      update: { passwordHash, role: a.role, status: "ACTIVE", failedLogins: 0, lockedUntil: null },
      create: { email: a.email, name: a.name, passwordHash, role: a.role, emailVerified: new Date() },
    });
    const profile = {
      username: a.username, displayName: a.name, designation: a.designation, qualification: a.qualification, institutionId: inst.id,
      interests: ["Neuroradiology", "Chest / Thoracic"], verificationStatus: "VERIFIED", verifiedAt: new Date(), onboardingDone: true,
      pgYear: a.designation === "PG2" ? 2 : null,
    };
    await db.userProfile.upsert({ where: { userId: user.id }, update: profile, create: { userId: user.id, ...profile } });
    console.log(`${a.role.padEnd(6)} ${a.email}  /  ${a.password}`);
  }
} finally {
  await db.$disconnect();
}
