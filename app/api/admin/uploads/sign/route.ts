/**
 * POST /api/admin/uploads/sign
 *
 * Storage target: Cloudflare R2 (S3-compatible). The handler uses the
 * AWS SDK v3's S3Client + getSignedUrl to mint a 15-minute presigned PUT
 * URL the browser can upload to directly. Required env vars:
 *
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 *   R2_PUBLIC_URL  (public base URL for the bucket — e.g. https://pub-xxx.r2.dev)
 *
 * The endpoint is admin-gated and rate-limited to 20 requests/minute per IP.
 */

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireAdmin } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { uploadSignSchema } from "@/lib/validators";

const PRESIGN_EXPIRY_SECONDS = 60 * 15;
const MAX_SANITIZED_FILENAME_LENGTH = 80;

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SANITIZED_FILENAME_LENGTH) || "upload";
}

function getR2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    },
  });
}

export async function POST(request: Request) {
  const limit = await rateLimit(request, { limit: 20, windowMs: 60_000 });
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

  const body = await request.json().catch(() => null);
  const parsed = uploadSignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 422 }
    );
  }

  const bucket = process.env.R2_BUCKET_NAME;
  const publicBase = process.env.R2_PUBLIC_URL;
  if (!bucket || !publicBase || !process.env.R2_ACCOUNT_ID) {
    return NextResponse.json(
      { message: "Upload storage is not configured on this environment." },
      { status: 503 }
    );
  }

  const safeName = sanitizeFilename(parsed.data.filename);
  const key = `uploads/${parsed.data.context}/${randomUUID()}-${safeName}`;

  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: parsed.data.contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: PRESIGN_EXPIRY_SECONDS,
  });

  const publicUrl = `${publicBase.replace(/\/+$/, "")}/${key}`;

  return NextResponse.json({ uploadUrl, publicUrl, key }, { status: 200 });
}
