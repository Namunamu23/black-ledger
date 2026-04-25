import Link from "next/link";
import { Card, Pill, StampBadge } from "@/components/ui";
import BuyButton from "@/components/bureau/BuyButton";

type CasePublicViewProps = {
  caseFile: {
    id: number;
    title: string;
    slug: string;
    summary: string;
    players: string;
    duration: string;
    difficulty: string;
  };
  previewMode?: boolean;
  adminBackHref?: string;
  canBuy?: boolean;
};

export default function CasePublicView({
  caseFile,
  previewMode = false,
  adminBackHref,
  canBuy = false,
}: CasePublicViewProps) {
  return (
    <main className="relative min-h-screen bg-[#050507] text-zinc-100">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(185,28,28,0.18),transparent_28%),radial-gradient(circle_at_80%_5%,rgba(14,116,144,0.15),transparent_26%),radial-gradient(circle_at_50%_92%,rgba(245,158,11,0.08),transparent_30%),linear-gradient(to_bottom,#050507,#09090b_50%,#030304)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:54px_54px] opacity-20"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(to_bottom,rgba(255,255,255,0.03)_0px,rgba(255,255,255,0.03)_1px,transparent_1px,transparent_5px)] opacity-[0.04]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-red-500/50 to-transparent"
        aria-hidden
      />

      <div className="relative mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {previewMode ? (
          <Card
            variant="dossier"
            padding="md"
            className="mb-6 border-amber-500/20"
          >
            <Pill tone="warning" label="Admin Preview" />
            <p className="mt-3 text-sm text-zinc-400">
              Previewing as public — case may still be unpublished.
            </p>
            {adminBackHref ? (
              <Link
                href={adminBackHref}
                className="mt-4 inline-flex items-center rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Back to Editor
              </Link>
            ) : null}
          </Card>
        ) : null}

        {/* Hero */}
        <Card variant="dossier" padding="none">
          <div className="border-b border-red-950/70 bg-gradient-to-r from-red-950/30 via-zinc-950 to-cyan-950/20 px-5 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_22px_rgba(239,68,68,0.95)]"
                  aria-hidden
                />
                <span className="font-mono text-[11px] uppercase tracking-[0.34em] text-red-200">
                  Case Detail
                </span>
                <Pill tone="success" label="Available" />
                <StampBadge label="Field Ready" tone="amber" size="sm" />
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                Physical + Digital Investigation
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
              BL-001 / Standalone Investigation
            </div>
            <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
              {caseFile.title}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
              {caseFile.summary}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Pill tone="neutral" label={caseFile.players} />
              <Pill tone="neutral" label={caseFile.duration} />
              <Pill tone="neutral" label={caseFile.difficulty} />
            </div>
          </div>
        </Card>

        {/* Two-column info + CTA */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card variant="dossier" padding="lg">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full bg-emerald-500"
                aria-hidden
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-400">
                What&apos;s Included
              </span>
            </div>
            <h2 className="mt-3 text-xl font-semibold text-white">
              Physical evidence kit + full digital access
            </h2>
            <ul className="mt-4 space-y-3">
              <li className="flex items-start gap-3">
                <span
                  className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500"
                  aria-hidden
                />
                <span className="text-sm leading-6 text-zinc-300">
                  Printed case materials — reports, statements, maps, and
                  supporting records designed to feel deliberate and real.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span
                  className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500"
                  aria-hidden
                />
                <span className="text-sm leading-6 text-zinc-300">
                  Physical evidence cards matching key records in the digital
                  bureau.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span
                  className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500"
                  aria-hidden
                />
                <span className="text-sm leading-6 text-zinc-300">
                  At least one QR-coded artifact that unlocks hidden digital
                  evidence not in the printed file.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span
                  className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500"
                  aria-hidden
                />
                <span className="text-sm leading-6 text-zinc-300">
                  Activation code for full bureau access — staged progression,
                  structured hints, and final theory evaluation.
                </span>
              </li>
            </ul>
          </Card>

          <Card variant="dossier" padding="lg">
            <Pill tone="success" label="Available Now" />
            <h2 className="mt-4 text-xl font-semibold text-white">
              Get the investigation kit
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Order includes the physical case file and lifetime digital
              bureau access. Ships within 3–5 business days.
            </p>
            {canBuy ? (
              <BuyButton caseId={caseFile.id} />
            ) : (
              <Link
                href="/support"
                className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-amber-400 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-amber-300"
              >
                Order Investigation Kit
              </Link>
            )}
            <div className="mt-4 flex items-center gap-3">
              <hr className="flex-1 border-zinc-800" />
              <span className="font-mono text-[10px] text-zinc-600">OR</span>
              <hr className="flex-1 border-zinc-800" />
            </div>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Sign in to Bureau
            </Link>
            <p className="mt-3 text-center text-xs text-zinc-600">
              Already purchased? Sign in and enter your activation code.
            </p>
          </Card>
        </div>

        <div className="mt-4">
          <Link
            href="/cases"
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-600 transition hover:text-zinc-400"
          >
            ← Back to Case Archive
          </Link>
        </div>
      </div>
    </main>
  );
}
