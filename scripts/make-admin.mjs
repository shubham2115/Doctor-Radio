// Usage: npm run make-admin -- you@example.com [ADMIN|MODERATOR]
// Promotes an existing user and marks their profile as verified (bootstrap for the first moderator).
import { PrismaClient } from "@prisma/client";

const [email, role = "ADMIN"] = process.argv.slice(2);
if (!email || !["ADMIN", "MODERATOR"].includes(role)) {
  console.error("Usage: npm run make-admin -- <email> [ADMIN|MODERATOR]");
  process.exit(1);
}
const db = new PrismaClient();
try {
  const user = await db.user.update({ where: { email: email.toLowerCase() }, data: { role } });
  await db.userProfile.updateMany({ where: { userId: user.id }, data: { verificationStatus: "VERIFIED", verifiedAt: new Date() } });
  await db.auditLog.create({ data: { actorId: user.id, action: "admin.bootstrap", entity: "User", entityId: user.id, metadata: { role } } });
  console.log(`${email} is now ${role} and verified.`);
} catch (e) {
  console.error(e.code === "P2025" ? `No user with email ${email}. Register first.` : e);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
