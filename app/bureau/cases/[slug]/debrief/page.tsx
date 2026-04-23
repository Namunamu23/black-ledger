import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, Pill, StampBadge } from "@/components/ui";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function CaseDebriefPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  const userId = Number((session?.user as { id?: string } | undefined)?.id);

  if (!Number.isInteger(userId)) {
    notFound();
  }

  const solvedCase = await prisma.userCase.findFirst({
    where: {
      userId,
      status: "SOLVED",
      caseFile: { slug },
    },
    include: {
      caseFile: true,
    },
  });

  if (!solvedCase) {
    notFound();
  }

  const { caseFile } = solvedCase;

  const caseSerial = "BL-" + slug.toUpperCase().replace(/-/g, "").slice(0, 8);

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

      <div className="relative mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Hero header — emerald accents (resolved state) */}
        <Card variant="dossier" padding="none" className="border-emerald-950/50">
          <div className="border-b border-emerald-950/60 bg-gradient-to-r from-emerald-950/30 via-zinc-950 to-cyan-950/20 px-5 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_22px_rgba(16,185,129,0.95)]"
                  aria-hidden
                />
                <span className="font-mono text-[11px] uppercase tracking-[0.34em] text-emerald-200">
                  Case Debrief
                </span>
                <Pill tone="success" label="Case Resolved" />
                <StampBadge label="Case Closed" tone="green" size="md" rotate />
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                Node BLB-NY-01 / Final Assessment
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
              {caseSerial}
            </div>
            <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
              {caseFile.title} — Debrief
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
              {caseFile.debriefOverview}
            </p>
          </div>
        </Card>

        {/* Optional intro */}
        {caseFile.debriefIntro ? (
          <div className="mt-4">
            <Card variant="dossier" padding="md">
              <p className="text-sm leading-7 text-zinc-400">
                {caseFile.debriefIntro}
              </p>
            </Card>
          </div>
        ) : null}

        {/* Three debrief sections */}
        <div className="mt-4 grid gap-4">
          <Card variant="dossier" padding="lg">
            <div className="mb-4 flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full bg-amber-500"
                aria-hidden
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-amber-400">
                What Happened
              </span>
            </div>
            <p className="text-sm leading-8 text-zinc-300">
              {caseFile.debriefWhatHappened}
            </p>
          </Card>

          <Card variant="dossier" padding="lg">
            <div className="mb-4 flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full bg-cyan-500"
                aria-hidden
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-400">
                {caseFile.debriefSectionTitle ?? "Why Your Theory Was Incomplete"}
              </span>
            </div>
            <p className="text-sm leading-8 text-zinc-300">
              {caseFile.debriefWhyItWorked}
            </p>
          </Card>

          <Card variant="dossier" padding="lg">
            <div className="mb-4 flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full bg-zinc-500"
                aria-hidden
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                Closing Notes
              </span>
            </div>
            <p className="text-sm leading-8 text-zinc-300">
              {caseFile.debriefClosing}
            </p>
          </Card>
        </div>
      </div>
    </main>
  );
}
