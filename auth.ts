import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validators";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);

        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });

        if (!user) return null;

        const passwordMatches = await compare(
          parsed.data.password,
          user.passwordHash
        );

        if (!passwordMatches) return null;

        return {
          id: String(user.id),
          email: user.email,
          name: user.name ?? user.email,
          role: user.role,
          tokenVersion: user.tokenVersion,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async session({ session, token }) {
      if (!session.user || token.id == null) {
        return session;
      }

      // Verify the JWT's tokenVersion matches the user's current version.
      // A password reset increments user.tokenVersion, instantly invalidating
      // every existing JWT for that user. Pre-existing JWTs from before the
      // tokenVersion field was introduced have token.tokenVersion === undefined,
      // which we treat as 0 — matching the @default(0) on the column — so
      // existing sessions stay valid until they expire or the user resets.
      //
      // This callback overrides the trivial pass-through in auth.config.ts;
      // it runs only when auth() is called from a route handler, page, or
      // server action — never from middleware (which runs on edge).
      const expectedVersion = (token.tokenVersion as number | undefined) ?? 0;
      const dbUser = await prisma.user.findUnique({
        where: { id: Number(token.id) },
        select: { tokenVersion: true },
      });

      if (!dbUser || dbUser.tokenVersion !== expectedVersion) {
        // Stale session — clear user fields so guards (`requireSession`,
        // `requireAdmin`, `requireSessionJson`) treat the request as anonymous.
        return { ...session, user: undefined as unknown as typeof session.user };
      }

      session.user.id = token.id;
      session.user.role = token.role;
      session.user.tokenVersion = dbUser.tokenVersion;
      return session;
    },
  },
});