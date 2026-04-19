import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth ?? null;
  const role = (session?.user as { role?: string } | undefined)?.role;

  // /bureau/admin/* — must be checked before the generic /bureau/* branch
  if (pathname.startsWith("/bureau/admin")) {
    if (!session?.user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/bureau", req.url));
    }
    return NextResponse.next();
  }

  // /bureau/* — any authenticated user
  if (pathname.startsWith("/bureau")) {
    if (!session?.user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  }

  // /api/admin/* — must be checked before /api/cases/* (no overlap, but consistent ordering)
  if (pathname.startsWith("/api/admin")) {
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    return NextResponse.next();
  }

  // /api/cases/* — any authenticated user
  if (pathname.startsWith("/api/cases")) {
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/bureau/:path*",
    "/api/cases/:path*",
    "/api/admin/:path*",
  ],
};
