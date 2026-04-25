import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const STATE_MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth ?? null;
  const role = (session?.user as { role?: string } | undefined)?.role;

  // CSRF: state-mutating /api/ requests must come from our own origin.
  // /api/auth/* is excluded — NextAuth has its own CSRF token flow.
  // /api/webhooks/* is excluded — third parties (Stripe, etc.) post from
  //   their own servers; signature verification happens inside the handler.
  // Safe methods (GET/HEAD) are skipped because they don't change state.
  if (
    STATE_MUTATING_METHODS.has(req.method) &&
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/auth/") &&
    !pathname.startsWith("/api/webhooks/")
  ) {
    const origin = req.headers.get("origin");
    if (!origin || origin !== APP_ORIGIN) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }
  }

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

  // /bureau/unlock is publicly reachable so players can see
  // the unlock form when arriving from a QR code before signing in.
  // Auth is enforced at the API level in /api/access-codes/redeem.
  if (pathname.startsWith("/bureau/unlock")) {
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
    // Catch-all on /api/ so the CSRF gate runs on every state-mutating
    // request (waitlist, support, etc.). The middleware function above
    // skips /api/auth/* explicitly.
    "/api/:path*",
  ],
};
