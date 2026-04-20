/**
 * Auth guards used by server components, layouts, and API routes.
 *
 * Three flavors:
 *   - requireSession(): for pages/layouts that should redirect to /login
 *     when there is no session. Returns the typed Session on success;
 *     never returns undefined (redirect() throws a NEXT_REDIRECT signal
 *     that Next.js intercepts).
 *
 *   - requireAdmin(): for admin API routes. Returns the Session when the
 *     caller is an authenticated ADMIN, otherwise returns a 403 JSON
 *     NextResponse the caller should return as-is. Use the
 *     `result instanceof NextResponse` discriminator at the call site.
 *
 *   - getOptionalSession(): for pages that read the session for display
 *     but already rely on a layout or middleware for auth gating, or
 *     deliberately render content for both authed and anonymous users.
 *
 * Pages that use notFound() instead of redirect on missing session, and
 * non-admin API routes that return 401 JSON, do not use these helpers —
 * their patterns differ in intentional ways.
 */

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { UserRole } from "@/lib/enums";

export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

export async function requireAdmin(): Promise<Session | NextResponse> {
  const session = await auth();
  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }
  return session;
}

export async function getOptionalSession(): Promise<Session | null> {
  const session = await auth();
  return session ?? null;
}
