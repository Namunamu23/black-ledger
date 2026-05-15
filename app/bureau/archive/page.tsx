import Link from "next/link";
import { getOptionalSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import SectionHeader from "@/components/ui/SectionHeader";
import Reveal from "@/components/ui/Reveal";
import StatusBadge from "@/components/bureau/StatusBadge";
import ArchiveStatCard from "@/components/bureau/ArchiveStatCard";

export default async function BureauArchivePage() {
  const session = await getOptionalSession();
  const userId = Number(session?.user?.id);

  // Mirror the Batch 16 dashboard + debrief filter (`revokedAt: null`):
  // refunded UserCase rows must not appear in the archive's "Active reviews"
  // or "Debrief-ready cases" surfaces, otherwise a refunded customer sees
  // their old case looking active and the Debrief CTA renders against a
  // revoked entitlement. Theory-submission history (below) is preserved
  // intentionally — submissions are an audit trail of what was guessed;
  // hiding them on refund would also hide them from the player's own
  // recollection of their attempts.
  const ownedCases = Number.isInteger(userId)
    ? await prisma.userCase.findMany({
        where: { userId, revokedAt: null },
        include: { caseFile: true },
        orderBy: { activatedAt: "desc" },
      })
    : [];

  const submissions = Number.isInteger(userId)
    ? await prisma.theorySubmission.findMany({
        where: { userId },
        include: { caseFile: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
    : [];

  const solvedCases = ownedCases.filter((entry) => entry.status === "SOLVED");
  const activeCases = ownedCases.filter((entry) => entry.status !== "SOLVED");

  return (
    <main className="bg-zinc-950 text-white">
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <SectionHeader
              eyebrow="Archive"
              title="Your case history"
              text="A long-term view of your active reviews, solved files, and recent theory submissions."
            />
          </Reveal>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <Reveal>
              <ArchiveStatCard label="Owned cases" value={ownedCases.length} />
            </Reveal>
            <Reveal delay={0.05}>
              <ArchiveStatCard label="Active reviews" value={activeCases.length} />
            </Reveal>
            <Reveal delay={0.1}>
              <ArchiveStatCard label="Solved cases" value={solvedCases.length} />
            </Reveal>
          </div>

          <div className="mt-12">
            <Reveal>
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Solved Files
              </div>
              <h2 className="mt-4 text-3xl font-semibold text-white">
                Debrief-ready cases
              </h2>
            </Reveal>

            {solvedCases.length === 0 ? (
              <Reveal delay={0.05}>
                <div className="mt-6 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
                  <p className="text-base leading-8 text-zinc-300">
                    No solved cases in the archive yet.
                  </p>
                </div>
              </Reveal>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {solvedCases.map((entry, index) => (
                  <Reveal key={entry.id} delay={index * 0.06}>
                    <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                          Case File
                        </div>
                        <StatusBadge status={entry.status} />
                      </div>

                      <h3 className="mt-4 text-2xl font-semibold text-white">
                        {entry.caseFile.title}
                      </h3>
                      <p className="mt-4 text-sm leading-7 text-zinc-300">
                        {entry.caseFile.summary}
                      </p>

                      <div className="mt-6 flex flex-wrap gap-4">
                        <Link
                          href={`/bureau/cases/${entry.caseFile.slug}`}
                          className="rounded-2xl border border-zinc-700 px-5 py-3 font-semibold text-white transition hover:bg-zinc-950"
                        >
                          Workspace
                        </Link>
                        <Link
                          href={`/bureau/cases/${entry.caseFile.slug}/debrief`}
                          className="rounded-2xl bg-white px-5 py-3 font-semibold text-zinc-950 transition hover:bg-zinc-200"
                        >
                          Debrief
                        </Link>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            )}
          </div>

          <div className="mt-12">
            <Reveal>
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Recent Theory History
              </div>
              <h2 className="mt-4 text-3xl font-semibold text-white">
                Latest submissions
              </h2>
            </Reveal>

            {submissions.length === 0 ? (
              <Reveal delay={0.05}>
                <div className="mt-6 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
                  <p className="text-base leading-8 text-zinc-300">
                    No theory submissions in the archive yet.
                  </p>
                </div>
              </Reveal>
            ) : (
              <div className="mt-6 space-y-4">
                {submissions.map((submission, index) => {
                  const isClosed = submission.resultLabel === "CORRECT";
                  const badgeColor = isClosed
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-300";

                  return (
                    <Reveal key={submission.id} delay={index * 0.04}>
                      <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                              {submission.caseFile.title}
                            </div>
                            <h3 className="mt-2 text-xl font-semibold text-white">
                              {submission.suspectName}
                            </h3>
                          </div>

                          <span className={`rounded-full border px-3 py-1 text-xs ${badgeColor}`}>
                            {isClosed ? "Closure Standard Met" : "Revision Required"}
                          </span>
                        </div>

                        <div className="mt-4 text-sm text-zinc-400">
                          Bureau Verdict
                        </div>
                        <div className="mt-1 text-sm leading-7 text-zinc-300">
                          {isClosed
                            ? submission.feedback
                            : "The file is not ready for closure. The Bureau could not verify a complete chain of suspect, motive, and supporting evidence."}
                        </div>

                        <div className="mt-4 text-sm text-zinc-400">
                          Submitted
                        </div>
                        <div className="mt-1 text-sm text-zinc-300">
                          {submission.createdAt.toLocaleString()}
                        </div>
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}