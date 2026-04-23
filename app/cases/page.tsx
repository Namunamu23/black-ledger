import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, Pill } from "@/components/ui";

const BTN_OUTLINE_SM =
  "inline-flex items-center rounded-2xl border border-zinc-700 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-zinc-800";

export default async function CasesPage() {
  const cases = await prisma.caseFile.findMany({
    where: {
      isActive: true,
      workflowStatus: "PUBLISHED",
    },
    orderBy: { createdAt: "asc" },
  });

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
        <Card variant="dossier" padding="none">
          <div className="border-b border-red-950/70 bg-gradient-to-r from-red-950/30 via-zinc-950 to-cyan-950/20 px-5 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_22px_rgba(239,68,68,0.95)]"
                  aria-hidden
                />
                <span className="font-mono text-[11px] uppercase tracking-[0.34em] text-red-200">
                  Case Archive
                </span>
                <Pill tone="danger" label="Classified" />
                <Pill tone="neutral" label={`${cases.length} Active Files`} />
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                Node BLB-NY-01 / Public Index
              </div>
            </div>
          </div>

          <div className="p-6">
            <h1 className="text-3xl font-semibold text-white">
              Open Investigations
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
              A growing archive of premium investigative case files. Each case
              ships as a physical evidence kit with full digital bureau access.
            </p>
          </div>
        </Card>

        {cases.length === 0 ? (
          <Card variant="dossier" padding="lg" className="mt-6">
            <p className="font-mono text-sm text-zinc-500">
              No active case files available at this time.
            </p>
          </Card>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {cases.map((caseFile, index) => {
              const serial = "BL-" + String(index + 1).padStart(3, "0");
              return (
                <Card key={caseFile.id} variant="dossier" padding="none">
                  <div className="flex items-center justify-between border-b border-red-950/50 px-4 py-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-600">
                      Case File
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                      {serial}
                    </span>
                  </div>
                  <div className="p-5">
                    <h2 className="text-xl font-semibold text-white">
                      {caseFile.title}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-zinc-400">
                      {caseFile.summary}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Pill tone="neutral" label={caseFile.players} />
                      <Pill tone="neutral" label={caseFile.duration} />
                      <Pill tone="neutral" label={caseFile.difficulty} />
                    </div>
                    <Link
                      href={`/cases/${caseFile.slug}`}
                      className={`mt-4 ${BTN_OUTLINE_SM}`}
                    >
                      Open File →
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
