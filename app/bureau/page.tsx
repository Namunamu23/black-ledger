import { Suspense } from "react";
import Link from "next/link";
import { getOptionalSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import SignOutButton from "@/components/auth/SignOutButton";
import CaseActivationForm from "@/components/bureau/CaseActivationForm";
import StatusBadge from "@/components/bureau/StatusBadge";
import {
  Card,
  Pill,
  StampBadge,
  TerminalReadout,
} from "@/components/ui";

// Button-shaped Links. The codebase convention is Link + inline className,
// so navigation actions use these constants rather than the Button
// primitive (which renders an HTML <button> and isn't navigable).
const BTN_PRIMARY_SM =
  "inline-flex items-center rounded-2xl bg-amber-400 px-3 py-1.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300";
const BTN_OUTLINE_SM =
  "inline-flex items-center rounded-2xl border border-zinc-700 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-zinc-800";
const BTN_PRIMARY_MD =
  "inline-flex items-center rounded-2xl bg-amber-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300";
const BTN_OUTLINE_MD =
  "inline-flex items-center rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800";

export default async function BureauPage() {
  const session = await getOptionalSession();
  const userId = Number(session?.user?.id);

  const ownedCases = Number.isInteger(userId)
    ? await prisma.userCase.findMany({
        where: { userId },
        include: { caseFile: true },
        orderBy: { activatedAt: "desc" },
      })
    : [];

  const theorySubmissionCount = Number.isInteger(userId)
    ? await prisma.theorySubmission.count({
        where: { userId },
      })
    : 0;

  const solvedCases = ownedCases.filter((entry) => entry.status === "SOLVED");
  const activeCases = ownedCases.filter((entry) => entry.status !== "SOLVED");

  const latestSolved = solvedCases
    .filter((entry) => entry.completedAt)
    .sort((a, b) => {
      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return bTime - aTime;
    })[0];

  const userEmail = session?.user?.email ?? "Unknown user";
  const userRole =
    (session?.user as { role?: string } | undefined)?.role ?? "INVESTIGATOR";

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
        {/* System header */}
        <Card variant="dossier" padding="none">
          <div className="border-b border-red-950/70 bg-gradient-to-r from-red-950/30 via-zinc-950 to-cyan-950/20 px-5 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_22px_rgba(239,68,68,0.95)]"
                  aria-hidden
                />
                <span className="font-mono text-[11px] uppercase tracking-[0.34em] text-red-200">
                  Black Ledger Bureau Intelligence System
                </span>
                <Pill tone="danger" label="Classified Session" />
                <Pill tone="success" label="Auth Verified" />
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                Node BLB-NY-01 / Case Archive / Live Query
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                Operative Identity
              </div>
              <div className="mt-2 font-mono text-lg text-white">
                {userEmail}
              </div>
              <div className="mt-3">
                <Pill
                  tone={userRole === "ADMIN" ? "classified" : "neutral"}
                  label={userRole}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 lg:justify-end">
              {userRole === "ADMIN" ? (
                <Link href="/bureau/admin/cases" className={BTN_OUTLINE_SM}>
                  Admin Panel
                </Link>
              ) : null}
              <Link href="/bureau/database" className={BTN_OUTLINE_SM}>
                Global Database
              </Link>
              <Link href="/bureau/archive" className={BTN_OUTLINE_SM}>
                Archive
              </Link>
              <SignOutButton />
            </div>
          </div>
        </Card>

        {/* Stats row */}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Card variant="dossier" padding="sm">
            <TerminalReadout
              label="OWNED CASES"
              tone="amber"
              lines={[`${ownedCases.length} files on record`]}
            />
          </Card>
          <Card variant="dossier" padding="sm">
            <TerminalReadout
              label="SOLVED CASES"
              tone="green"
              lines={[`${solvedCases.length} resolved`]}
            />
          </Card>
          <Card variant="dossier" padding="sm">
            <TerminalReadout
              label="THEORY SUBMISSIONS"
              tone="cyan"
              lines={[`${theorySubmissionCount} total attempts`]}
            />
          </Card>
        </div>

        {/* Activation */}
        <div className="mt-6">
          <Card variant="dossier" padding="lg">
            <div className="flex items-center gap-3">
              <Pill tone="warning" label="Access Code Required" />
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                — Case Activation Protocol
              </span>
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-white">
              Add a case to your archive
            </h2>
            <p className="mt-3 text-sm leading-7 text-zinc-400">
              Enter a valid activation code to link a case file to your
              operative account.
            </p>
            <div className="mt-6">
              {/* Suspense required — CaseActivationForm reads useSearchParams */}
              <Suspense fallback={null}>
                <CaseActivationForm />
              </Suspense>
            </div>
          </Card>
        </div>

        {/* Active reviews */}
        <div className="mt-8">
          <div className="mb-4 flex items-center gap-3">
            <span
              className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.85)]"
              aria-hidden
            />
            <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
              Active Reviews
            </span>
          </div>

          {activeCases.length === 0 ? (
            <Card variant="dossier" padding="lg">
              <TerminalReadout
                tone="neutral"
                label="STATUS"
                lines={["No active cases on record."]}
              />
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {activeCases.map((entry, index) => (
                <Card key={entry.id} variant="dossier" padding="none">
                  <div className="flex items-center justify-between border-b border-red-950/50 px-5 py-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-600">
                      Case File
                    </span>
                    <StatusBadge status={entry.status} />
                  </div>
                  <div className="p-5">
                    <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
                      BL-CASE-{String(index + 1).padStart(3, "0")}
                    </div>
                    <h3 className="mt-2 text-xl font-semibold text-white">
                      {entry.caseFile.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-zinc-400">
                      {entry.caseFile.summary}
                    </p>

                    <div className="mt-4">
                      <TerminalReadout
                        tone="amber"
                        label="STAGE PROGRESSION"
                        lines={[
                          `Stage ${entry.currentStage} / ${
                            entry.caseFile.maxStage
                          } — ${Math.round(
                            (entry.currentStage / entry.caseFile.maxStage) * 100
                          )}% complete`,
                        ]}
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link
                        href={`/bureau/cases/${entry.caseFile.slug}`}
                        className={BTN_PRIMARY_SM}
                      >
                        Open Workspace
                      </Link>
                      <Link
                        href={`/bureau/cases/${entry.caseFile.slug}/database`}
                        className={BTN_OUTLINE_SM}
                      >
                        Database
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Completed archive */}
        <div className="mt-8">
          <div className="mb-4 flex items-center gap-3">
            <span
              className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.85)]"
              aria-hidden
            />
            <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
              Completed Archive
            </span>
          </div>

          {solvedCases.length === 0 ? (
            <Card variant="dossier" padding="lg">
              <TerminalReadout
                tone="neutral"
                label="STATUS"
                lines={["No solved cases in archive."]}
              />
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {solvedCases.map((entry) => (
                <Card
                  key={entry.id}
                  variant="dossier"
                  padding="none"
                  className="border-emerald-950/50"
                >
                  <div className="flex items-center justify-between border-b border-emerald-950/50 px-5 py-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-600">
                      Solved File
                    </span>
                    <StampBadge label="File Closed" tone="green" size="sm" />
                  </div>
                  <div className="p-5">
                    <h3 className="text-xl font-semibold text-white">
                      {entry.caseFile.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-zinc-400">
                      {entry.caseFile.summary}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link
                        href={`/bureau/cases/${entry.caseFile.slug}`}
                        className={BTN_OUTLINE_SM}
                      >
                        Workspace
                      </Link>
                      <Link
                        href={`/bureau/cases/${entry.caseFile.slug}/debrief`}
                        className={BTN_PRIMARY_SM}
                      >
                        Open Debrief
                      </Link>
                      <Link
                        href={`/bureau/cases/${entry.caseFile.slug}/database`}
                        className={BTN_OUTLINE_SM}
                      >
                        Database
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Latest solved callout */}
        {latestSolved ? (
          <div className="mt-8">
            <Card
              variant="dossier"
              padding="lg"
              className="border-amber-500/20"
            >
              <Pill tone="warning" label="Recently Closed" />
              <h2 className="mt-4 text-2xl font-semibold text-white">
                {latestSolved.caseFile.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                Your most recently completed case. Debrief available.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={`/bureau/cases/${latestSolved.caseFile.slug}/debrief`}
                  className={BTN_PRIMARY_MD}
                >
                  View Debrief
                </Link>
                <Link
                  href={`/bureau/cases/${latestSolved.caseFile.slug}/database`}
                  className={BTN_OUTLINE_MD}
                >
                  Database
                </Link>
              </div>
            </Card>
          </div>
        ) : null}
      </div>
    </main>
  );
}
