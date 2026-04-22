"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { AccessCodeWithCount } from "./AccessCodesPanel";

type Props = { codes: AccessCodeWithCount[] };

// Spec hardcodes the production origin so a printed QR code remains
// stable regardless of which environment generates it. Swap to
// NEXT_PUBLIC_APP_URL if per-env QR images become useful.
const CODE_URL_BASE = "https://blackledger.app/u";

function urlFor(code: string) {
  return `${CODE_URL_BASE}/${encodeURIComponent(code)}`;
}

function describeTarget(unlocksTarget: unknown): string {
  const target = unlocksTarget as { type?: string; id?: number } | null;
  if (!target || typeof target.type !== "string") return "unknown target";
  return `${target.type} #${target.id ?? "?"}`;
}

export default function AccessCodeList({ codes }: Props) {
  if (codes.length === 0) {
    return (
      <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8 text-center text-sm text-zinc-400">
        No access codes yet for this case.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {codes.map((code) => (
        <AccessCodeRow key={code.id} code={code} />
      ))}
    </div>
  );
}

function AccessCodeRow({ code }: { code: AccessCodeWithCount }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle"
  );

  const url = urlFor(code.code);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: 160, margin: 1 })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 1500);
    }
  }

  const redemptionCount = code.redemptions.length;
  const createdLabel = new Date(code.createdAt).toISOString().slice(0, 10);

  return (
    <div className="grid gap-6 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6 md:grid-cols-[160px_1fr]">
      <div className="flex h-[160px] w-[160px] items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950">
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrDataUrl}
            alt={`QR code for ${code.code}`}
            className="h-full w-full rounded-2xl"
          />
        ) : (
          <span className="text-xs text-zinc-500">Generating...</span>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
            {code.kind}
          </span>
          {code.retiredAt ? (
            <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-red-300">
              Retired
            </span>
          ) : null}
          {code.oneTimePerUser ? (
            <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-400">
              One-time / user
            </span>
          ) : null}
        </div>

        <div className="mt-3 font-mono text-lg text-white">{code.code}</div>

        <div className="mt-3 grid gap-1 text-sm text-zinc-400">
          <div>
            <span className="text-zinc-500">Target: </span>
            <span className="text-zinc-200">
              {describeTarget(code.unlocksTarget)}
            </span>
          </div>
          <div>
            <span className="text-zinc-500">Requires stage: </span>
            <span className="text-zinc-200">
              {code.requiresStage ?? "any"}
            </span>
          </div>
          <div>
            <span className="text-zinc-500">Redemptions: </span>
            <span className="text-zinc-200">{redemptionCount}</span>
          </div>
          <div>
            <span className="text-zinc-500">Created: </span>
            <span className="text-zinc-200">{createdLabel}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <code className="rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-300">
            {url}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-2xl border border-zinc-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-950"
          >
            {copyState === "copied"
              ? "Copied ✓"
              : copyState === "error"
                ? "Copy failed"
                : "Copy URL"}
          </button>
        </div>
      </div>
    </div>
  );
}
