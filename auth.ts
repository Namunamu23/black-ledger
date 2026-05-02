import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validators";
import { authConfig } from "./auth.config";

// Lazily-computed bcrypt hash of a fixed placeholder. Used by the
// authorize callback to match wall-clock timing on the user-not-found
// path. The hash is computed once on first sign-in attempt and cached
// in module scope; subsequent attempts read the cached value.
let _constantTimeFakeHash: string | null = null;
async function getConstantTimeFakeHash(): Promise<string> {
  if (_constantTimeFakeHash === null) {
    _constantTimeFakeHash = await hash("__no_user_constant_time_placeholder__", 12);
  }
  return _constantTimeFakeHash;
}

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

        // Constant-time. If the user doesn't exist, run a bcrypt compare
        // against a lazily-computed fake hash so the wall-clock cost matches
        // the user-exists case. Without this, a timing attack distinguishes
        // "this email is registered" from "this email is not."
        //
        // The fake-hash pre-image is a fixed constant — even if an attacker
        // submits its plaintext, `!user` short-circuits the return-null below
        // before any session is issued, so this leaks nothing.
        const hashToCompare = user?.passwordHash ?? (await getConstantTimeFakeHash());
        const passwordMatches = await compare(parsed.data.password, hashToCompare);

        if (!user || !passwordMatches) return null;

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