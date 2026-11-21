// Creates (or updates) an ADMIN account in the database that DATABASE_URL points to.
// Safe for production: no demo defaults, password must be supplied and meet the app's policy.
//
// Usage:
//   ADMIN_PASSWORD='Str0ng-Passw0rd!' node scripts/create-admin.mjs you@example.com "Dr. Your Name"
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const [emailArg, nameArg = "Administrator"] = process.argv.slice(2);
const password = process.env.ADMIN_PASSWORD;
const email = emailArg?.trim().toLowerCase();

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !password) {
  console.error("Usage: ADMIN_PASSWORD='...' node scripts/create-admin.mjs <email> [\"Full Name\"]");
  process.exit(1);
}
if (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
  console.error("Password must be 10+ characters with upper-case, lower-case and a number.");
  process.exit(1);
}

const db = new PrismaClient();
try {
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.user.upsert({
    where: { email },
    update: { passwordHash, role: "ADMIN", status: "ACTIVE", failedLogins: 0, lockedUntil: null },
    create: { email, name: nameArg, passwordHash, role: "ADMIN", emailVerified: new Date() },
  });

  // Unique username derived from the email's local part.
  const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 24).padEnd(3, "_");
  const existing = await db.userProfile.findUnique({ where: { userId: user.id } });
  let username = existing?.username ?? base;
  if (!existing) {
    for (let i = 1; await db.userProfile.findUnique({ where: { username } }); i++) username = `${base}${i}`;
  }
  const data = { displayName: nameArg, verificationStatus: "VERIFIED", verifiedAt: new Date(), onboardingDone: true };
  await db.userProfile.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, username, designation: "FACULTY", interests: [], ...data },
  });
  await db.auditLog.create({ data: { actorId: user.id, action: "admin.bootstrap", entity: "User", entityId: user.id } });
  console.log(`Admin ready: ${email} (username: ${username})`);
} finally {
  await db.$disconnect();
}
