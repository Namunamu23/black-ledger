"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const searchSchema = z.object({
  name: z.string().trim().max(200).default(""),
  dateOfBirth: z.string().trim().max(40).default(""),
});

export type PersonSearchResult = {
  id: number;
  bureauId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  classification: string;
  riskLevel: string;
  status: string;
  personType: string;
  dateOfBirth: string | null;
  knownLocation: string | null;
  aliases: { alias: string }[];
};

export type SearchResponse =
  | { ok: true; results: PersonSearchResult[]; truncated: boolean; totalReturned: number }
  | { ok: false; reason: "unauthorized" | "invalid" | "empty" };

const MAX_RESULTS = 10;

/**
 * Bureau identity-database search. Server action invoked from
 * <GlobalPeopleSearchTerminal>. Returns up to MAX_RESULTS matched rows plus a
 * truncated flag when the underlying query had more than MAX_RESULTS rows.
 *
 * Search semantics:
 *   - `name` is optional. When provided, it is split on whitespace into
 *     tokens; each token must appear (case-insensitive partial match) in
 *     firstName, lastName, fullName, OR an alias of the row.
 *   - `dateOfBirth` is optional. When provided, it is matched against the
 *     stored DOB string using `contains` so partial dates work
 *     ("1990" matches "1990-11-03").
 *   - At least one of name / dateOfBirth must be non-empty; otherwise
 *     returns `{ ok: false, reason: "empty" }`.
 *
 * The Prisma `select` is intentionally narrow — only fields the client card
 * renders cross the server→client boundary. Same discipline as Batch 4 Fix 1.
 */
export async function searchBureauPeople(rawInput: {
  name?: string;
  dateOfBirth?: string;
}): Promise<SearchResponse> {
  const session = await auth();
  if (!session?.user) return { ok: false, reason: "unauthorized" };

  const parsed = searchSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, reason: "invalid" };

  const name = parsed.data.name.trim();
  const dob = parsed.data.dateOfBirth.trim();

  if (name.length === 0 && dob.length === 0) {
    return { ok: false, reason: "empty" };
  }

  const tokens =
    name.length > 0
      ? name
          .toLowerCase()
          .split(/\s+/)
          .filter((t) => t.length > 0)
      : [];

  const nameClauses = tokens.map((token) => ({
    OR: [
      { firstName: { contains: token, mode: "insensitive" as const } },
      { lastName: { contains: token, mode: "insensitive" as const } },
      { fullName: { contains: token, mode: "insensitive" as const } },
      {
        aliases: {
          some: { alias: { contains: token, mode: "insensitive" as const } },
        },
      },
    ],
  }));

  const where = {
    AND: [
      ...nameClauses,
      ...(dob.length > 0
        ? [{ dateOfBirth: { contains: dob, mode: "insensitive" as const } }]
        : []),
    ],
  };

  const rows = await prisma.globalPerson.findMany({
    where,
    select: {
      id: true,
      bureauId: true,
      firstName: true,
      lastName: true,
      fullName: true,
      classification: true,
      riskLevel: true,
      status: true,
      personType: true,
      dateOfBirth: true,
      knownLocation: true,
      aliases: { select: { alias: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    // Fetch one extra so we can detect a truncated result set without a
    // separate count query.
    take: MAX_RESULTS + 1,
  });

  const truncated = rows.length > MAX_RESULTS;
  const results = truncated ? rows.slice(0, MAX_RESULTS) : rows;

  return { ok: true, results, truncated, totalReturned: results.length };
}
