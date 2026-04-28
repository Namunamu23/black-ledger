import type { NextAuthConfig } from "next-auth";

// This file is imported by middleware.ts, which runs on Next.js's edge
// runtime. Edge runtime cannot load Prisma (or any code that imports
// Node-only modules like node:path / node:url). Keeping this file
// Prisma-free is what makes the middleware bundle valid on edge.
//
// The DB-checking session callback that verifies tokenVersion against
// the live User row lives in auth.ts, which is only imported by route
// handlers, pages, and server actions — all of which run on Node.
// Middleware uses the trivial JWT → session mapping below to do its
// coarse role/auth gating; route handlers run the full check via auth().

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
      // Edge-safe pass-through: copy JWT fields onto session.user so
      // middleware can read role/id without a DB call. The version
      // comparison happens in auth.ts's overriding session callback.
      if (session.user && token.id != null) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.tokenVersion = token.tokenVersion;
      }
      return session;
    },
  },
};
