import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import GlobalPeopleSearch from "@/components/bureau/GlobalPeopleSearch";

export default async function BureauGlobalDatabasePage() {
  const session = await auth();

  if (!session?.user) {
    notFound();
  }

  const people = await prisma.globalPerson.findMany({
    // Explicit select — every field listed here crosses the server→client
    // boundary into the <GlobalPeopleSearch> client component's RSC payload.
    // Do NOT add a field here without checking that the client component
    // reads it; do NOT switch any nested relation back to `include`. The
    // matching PersonSearchItem type in components/bureau/GlobalPeopleSearch.tsx
    // is the authoritative shape contract for what the client renders.
    select: {
      id: true,
      bureauId: true,
      firstName: true,
      lastName: true,
      fullName: true,
      dateOfBirth: true,
      knownLocation: true,
      status: true,
      personType: true,
      classification: true,
      riskLevel: true,
      relevanceLevel: true,
      profileSummary: true,
      gender: true,
      accessLevel: true,
      sourceReliability: true,
      confidenceLevel: true,
      watchlistFlag: true,
      aliases: { select: { alias: true } },
      caseAppearances: {
        select: {
          role: true,
          caseFile: { select: { title: true, slug: true } },
        },
      },
    },
    orderBy: {
      bureauId: "asc",
    },
  });

  const restrictedCount = people.filter(
    (person) => person.classification === "RESTRICTED"
  ).length;

  const internalCount = people.filter(
    (person) => person.classification === "BLACK_LEDGER_INTERNAL"
  ).length;

  const aliasCount = people.reduce(
    (total, person) => total + person.aliases.length,
    0
  );

  const caseConnectionCount = people.reduce(
    (total, person) => total + person.caseAppearances.length,
    0
  );

  return (
    <main className="min-h-screen overflow-hidden bg-[#050507] text-zinc-100">
      <section className="relative min-h-screen">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(185,28,28,0.22),transparent_30%),radial-gradient(circle_at_78%_4%,rgba(14,116,144,0.18),transparent_28%),radial-gradient(circle_at_50%_90%,rgba(245,158,11,0.10),transparent_34%),linear-gradient(to_bottom,#050507,#09090b_52%,#030304)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:54px_54px] opacity-25" />
        <div className="absolute inset-0 bg-[repeating-linear-gradient(to_bottom,rgba(255,255,255,0.035)_0px,rgba(255,255,255,0.035)_1px,transparent_1px,transparent_5px)] opacity-[0.045]" />
        <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />
        <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

        <div className="relative mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 overflow-hidden rounded-[1.75rem] border border-red-950/60 bg-black/55 shadow-2xl shadow-black/60 backdrop-blur-xl">
            <div className="border-b border-red-950/70 bg-gradient-to-r from-red-950/30 via-zinc-950 to-cyan-950/20 px-5 py-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_22px_rgba(239,68,68,0.95)]" />
                  <span className="font-mono text-[11px] uppercase tracking-[0.34em] text-red-200">
                    Black Ledger Bureau Intelligence System
                  </span>
                  <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-red-200">
                    Classified Session
                  </span>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-300">
                    Auth Verified
                  </span>
                </div>

                <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                  Node BLB-NY-01 / People Index / Live Query
                </div>
              </div>
            </div>

            <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="relative border-b border-red-950/50 p-6 lg:border-b-0 lg:border-r">
                <div className="absolute right-6 top-6 hidden font-mono text-[10px] uppercase tracking-[0.4em] text-zinc-800 sm:block">
                  Secure Archive
                </div>

                <div className="max-w-5xl">
                  <div className="text-xs uppercase tracking-[0.48em] text-amber-300">
                    Identity Intelligence Terminal
                  </div>

                  <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-zinc-50 sm:text-6xl lg:text-7xl">
                    Global Bureau Database
                  </h1>

                  <p className="mt-6 max-w-3xl text-base leading-8 text-zinc-300 sm:text-lg">
                    Search subject identities, aliases, decoys, victims,
                    associates, future-case persons, and restricted cross-case
                    intelligence indexed inside the Black Ledger universe.
                  </p>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                      href="/bureau"
                      className="rounded-2xl border border-zinc-700 bg-zinc-950/80 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:border-amber-400/50 hover:bg-zinc-900"
                    >
                      Return to Bureau
                    </Link>

                    <Link
                      href="/bureau/archive"
                      className="rounded-2xl border border-zinc-700 bg-zinc-950/80 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:border-cyan-400/50 hover:bg-zinc-900"
                    >
                      Case Archive
                    </Link>
                  </div>
                </div>
              </div>

              <div className="grid gap-0 sm:grid-cols-2">
                <IntelMetric
                  label="Indexed Identity Records"
                  value={people.length.toString()}
                  tone="amber"
                />
                <IntelMetric
                  label="Known Aliases"
                  value={aliasCount.toString()}
                  tone="cyan"
                />
                <IntelMetric
                  label="Case Linkage Points"
                  value={caseConnectionCount.toString()}
                  tone="zinc"
                />
                <IntelMetric
                  label="Restricted Files"
                  value={restrictedCount.toString()}
                  tone="red"
                />
              </div>
            </div>

            <div className="grid border-t border-red-950/50 md:grid-cols-4">
              <SystemReadout label="System Mode" value="Behavioral Intelligence" />
              <SystemReadout label="Internal Files" value={internalCount.toString()} />
              <SystemReadout label="Access Layer" value="Investigator" />
              <SystemReadout label="Query Scope" value="Universe Wide" />
            </div>
          </div>

          <GlobalPeopleSearch people={people} />
        </div>
      </section>
    </main>
  );
}

function IntelMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "red" | "amber" | "cyan" | "zinc";
}) {
  const toneClass = {
    red: "text-red-300 border-red-950/60 bg-red-950/15",
    amber: "text-amber-300 border-amber-950/60 bg-amber-950/15",
    cyan: "text-cyan-300 border-cyan-950/60 bg-cyan-950/15",
    zinc: "text-zinc-200 border-zinc-800 bg-zinc-950/40",
  }[tone];

  return (
    <div className={`border-b border-r p-6 ${toneClass}`}>
      <div className="font-mono text-[10px] uppercase tracking-[0.28em] opacity-70">
        {label}
      </div>
      <div className="mt-4 font-mono text-4xl font-semibold tracking-tight">
        {value}
      </div>
    </div>
  );
}

function SystemReadout({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-r border-red-950/40 bg-black/35 px-5 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-zinc-600">
        {label}
      </div>
      <div className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-zinc-300">
        {value}
      </div>
    </div>
  );
}