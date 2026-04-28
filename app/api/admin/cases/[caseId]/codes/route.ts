import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { generateCodesBatchSchema } from "@/lib/validators";

const RANDOM_PART_LENGTH = 10;

/**
 * Generate a random uppercase alphanumeric tail. Substituted for nanoid(10)
 * to avoid a new runtime dep — the codebase already uses crypto.randomBytes
 * for activation code entropy.
 */
function randomTail(): string {
  return randomBytes(8)
    .toString("base64url")
    .replace(/[-_]/g, "X")
    .slice(0, RANDOM_PART_LENGTH)
    .toUpperCase();
}

function buildCode(prefix: string): string {
  return `${prefix}${randomTail()}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { caseId } = await params;
  const parsedCaseId = Number(caseId);
  if (!Number.isInteger(parsedCaseId)) {
    return NextResponse.json({ message: "Invalid case id." }, { status: 400 });
  }

  const codes = await prisma.activationCode.findMany({
    where: { caseFileId: parsedCaseId },
    include: { claimedByUser: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
  });

  const url = new URL(request.url);
  if (url.searchParams.get("format") === "csv") {
    const header = "code,claimedBy,claimedAt,kitSerial,revokedAt";
    const rows = codes.map((c) => {
      const cells = [
        c.code,
        c.claimedByUser?.email ?? "",
        c.claimedAt ? c.claimedAt.toISOString() : "",
        c.kitSerial ?? "",
        c.revokedAt ? c.revokedAt.toISOString() : "",
      ].map(csvEscape);
      return cells.join(",");
    });
    const body = [header, ...rows].join("\n") + "\n";
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="case-${parsedCaseId}-codes.csv"`,
      },
    });
  }

  return NextResponse.json({ codes }, { status: 200 });
}

function csvEscape(value: string): string {
  // Prefix cells beginning with formula-trigger characters to prevent
  // CSV-injection in Excel / Numbers / Google Sheets. The leading apostrophe
  // is the standard mitigation; spreadsheets render the cell as text.
  const needsPrefix = /^[=+\-@\t\r]/.test(value);
  const safe = needsPrefix ? `'${value}` : value;
  if (safe.includes(",") || safe.includes('"') || safe.includes("\n")) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const limit = await rateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!limit.success) {
    return NextResponse.json(
      { message: "Too many requests." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }

  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { caseId } = await params;
  const parsedCaseId = Number(caseId);
  if (!Number.isInteger(parsedCaseId)) {
    return NextResponse.json({ message: "Invalid case id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = generateCodesBatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 422 }
    );
  }

  const caseFile = await prisma.caseFile.findUnique({
    where: { id: parsedCaseId },
  });
  if (!caseFile) {
    return NextResponse.json({ message: "Case not found." }, { status: 404 });
  }

  const prefix = (parsed.data.kitSerialPrefix ?? "").trim();
  const kitSerial = prefix.length > 0 ? prefix : null;

  // Generate the batch, then check the DB once for collisions and
  // regenerate any colliding codes. With 10-char base64url tails the
  // collision probability is vanishingly small even at 100 codes; the
  // check exists so a rare collision doesn't surface as a 500.
  let codes: string[] = Array.from({ length: parsed.data.count }, () =>
    buildCode(prefix)
  );
  for (let attempt = 0; attempt < 3; attempt++) {
    const collisions = await prisma.activationCode.findMany({
      where: { code: { in: codes } },
      select: { code: true },
    });
    if (collisions.length === 0) break;
    const taken = new Set(collisions.map((c) => c.code));
    codes = codes.map((c) => (taken.has(c) ? buildCode(prefix) : c));
  }

  await prisma.activationCode.createMany({
    data: codes.map((code) => ({
      code,
      kitSerial,
      caseFileId: parsedCaseId,
    })),
  });

  return NextResponse.json({ codes }, { status: 201 });
}
