import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "./db";

const creds = z.object({ email: z.string().email(), password: z.string().min(1) });

type AuthUser = { id: string; name: string; email: string; role: "RECRUITER" | "CLIENT"; clientId: string | null };

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      async authorize(raw) {
        const parsed = creds.safeParse(raw);
        if (!parsed.success) return null;
        const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
        if (!user) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        const out: AuthUser = { id: user.id, name: user.name, email: user.email, role: user.role, clientId: user.clientId };
        return out;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as unknown as AuthUser;
        token.uid = u.id;
        token.role = u.role;
        token.clientId = u.clientId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.role = token.role as "RECRUITER" | "CLIENT";
      session.user.clientId = (token.clientId as string | null) ?? null;
      return session;
    },
  },
});
