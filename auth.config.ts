import type { NextAuthConfig } from "next-auth";
import { prisma } from "@/lib/prisma";

export const authConfig: NextAuthConfig = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tokenVersion = user.tokenVersion;
      }
      return token;
    },
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
};
