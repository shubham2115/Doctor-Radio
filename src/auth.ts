import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { db } from "@/server/db";
import { loginSchema } from "@/lib/validation/auth";
import { audit } from "@/server/audit";
import { rateLimit } from "@/server/rate-limit";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role } & DefaultSession["user"];
  }
}

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
// Constant-time-ish dummy hash so unknown emails cost the same as wrong passwords.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            // Google asserts verified emails, so linking to an existing password account is safe.
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const limited = await rateLimit(`login:${email}`, 20, 15 * 60);
        if (!limited.ok) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) {
          await bcrypt.compare(password, DUMMY_HASH);
          return null;
        }
        if (user.status !== "ACTIVE") return null;
        if (user.lockedUntil && user.lockedUntil > new Date()) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          const failed = user.failedLogins + 1;
          await db.user.update({
            where: { id: user.id },
            data: {
              failedLogins: failed,
              lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
            },
          });
          await audit({ actorId: user.id, action: "auth.login_failed", entity: "User", entityId: user.id });
          return null;
        }

        await db.user.update({
          where: { id: user.id },
          data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
        });
        await audit({ actorId: user.id, action: "auth.login", entity: "User", entityId: user.id });
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.id) {
        const u = await db.user.findUnique({ where: { id: user.id }, select: { status: true } });
        if (u && u.status !== "ACTIVE") return false;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      if (token.sub) {
        // Re-read role/status so suspensions and role changes apply immediately.
        const u = await db.user.findUnique({ where: { id: token.sub }, select: { role: true, status: true } });
        if (!u || u.status !== "ACTIVE") return null;
        token.role = u.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.role = (token.role as Role) ?? "MEMBER";
      return session;
    },
  },
});
