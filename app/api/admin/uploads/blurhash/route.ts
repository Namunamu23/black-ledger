/**
 * POST /api/admin/uploads/blurhash
 *
 * Best-effort blurhash generation for an already-uploaded image. Fetches
 * the public URL, downsizes via sharp to 32px wide, then encodes a 4×3
 * component blurhash. Errors at any step (network, decode, encode) are
 * swallowed and the route returns 200 { blurhash: null } — blurhash is
 * cosmetic and must never block the upload UX.
 */

import { NextResponse } from "next/server";
import sharp from "sharp";
import { encode } from "blurhash";
import { requireAdmin } from "@/lib/auth-helpers";
import { blurhashRequestSchema } from "@/lib/validators";

const TARGET_WIDTH = 32;

async function generateBlurhash(publicUrl: string): Promise<string | null> {
  try {
    const response = await fetch(publicUrl);
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    const { data, info } = await sharp(inputBuffer)
      .resize({ width: TARGET_WIDTH, fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  const parsed = blurhashRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 422 }
    );
  }

  // SSRF guard. The public URL must resolve to the same host as the
  // configured R2 public bucket — otherwise an admin (or compromised
  // admin session) could submit `http://169.254.169.254/latest/meta-data/`
  // or any internal address the prod box can reach, and the server would
  // fetch it. Mismatches return the same {blurhash: null} shape used for
  // any other failure mode so attackers can't distinguish "blocked by
  // policy" from "fetch failed" via response timing or shape.
  let allowedHost: string | null = null;
  let submittedHost: string | null = null;
  try {
    if (process.env.R2_PUBLIC_URL) {
      allowedHost = new URL(process.env.R2_PUBLIC_URL).host;
    }
    submittedHost = new URL(parsed.data.publicUrl).host;
  } catch {
    // malformed URL — null hosts will fail the equality check below.
  }

  if (!allowedHost || submittedHost !== allowedHost) {
    return NextResponse.json({ blurhash: null }, { status: 200 });
  }

  const blurhash = await generateBlurhash(parsed.data.publicUrl);
  return NextResponse.json({ blurhash }, { status: 200 });
}
