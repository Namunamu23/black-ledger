import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import SectionHeader from "@/components/ui/SectionHeader";
import Reveal from "@/components/ui/Reveal";
import SignOutButton from "@/components/auth/SignOutButton";
import CaseActivationForm from "@/components/bureau/CaseActivationForm";
import StatusBadge from "@/components/bureau/StatusBadge";
import ArchiveStatCard from "@/components/bureau/ArchiveStatCard";

export default async function BureauPage() {
  const session = await auth();
  const userId = Number((session?.user as { id?: string } | undefined)?.id);

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
    <main className="bg-zinc-950 text-white">
      <section className="relative overflow-hidden border-b border-zinc-900 py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),transparent_30%)]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <Reveal>
            <SectionHeader
              eyebrow="Bureau"
              title="Your case archive"
              text="This is the long-term home of your active reviews, solved files, and final submissions."
            />
          </Reveal>

          <Reveal delay={0.08}>
            <div className="mt-10 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div>
                  <div className="text-sm text-zinc-400">Signed in as</div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {userEmail}
                  </div>
                  <div className="mt-2 text-sm uppercase tracking-[0.2em] text-amber-300">
                    {userRole}
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 lg:justify-end">
                  <Link
                    href="/bureau/archive"
                    className="rounded-2xl bg-white px-5 py-3 font-semibold text-zinc-950 transition hover:bg-zinc-200"
                  >
                    Open Archive
                  </Link>
                  <SignOutButton />
                </div>
              </div>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <Reveal>
              <ArchiveStatCard
                label="Owned cases"
                value={ownedCases.length}
                helper="All activated case files linked to your account."
              />
            </Reveal>
            <Reveal delay={0.05}>
              <ArchiveStatCard
                label="Solved cases"
                value={solvedCases.length}
                helper="Cases you have fully resolved."
              />
            </Reveal>
            <Reveal delay={0.1}>
              <ArchiveStatCard
                label="Theory submissions"
                value={theorySubmissionCount}
                helper="Total final theory attempts across your archive."
              />
            </Reveal>
          </div>

          <Reveal delay={0.12}>
            <div className="mt-10 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Activate a case
              </div>
              <h2 className="mt-4 text-3xl font-semibold text-white">
                Add a case to your archive
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-8 text-zinc-300">
                Enter a valid activation code to link a case to your account.
              </p>

              <div className="mt-8">
                <CaseActivationForm />
              </div>
            </div>
          </Reveal>

          <div className="mt-12">
            <Reveal>
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Active Reviews
              </div>
              <h2 className="mt-4 text-3xl font-semibold text-white">
                Continue investigating
              </h2>
            </Reveal>

            {activeCases.length === 0 ? (
              <Reveal delay={0.05}>
                <div className="mt-6 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
                  <p className="text-base leading-8 text-zinc-300">
                    No active cases right now.
                  </p>
                </div>
              </Reveal>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {activeCases.map((entry, index) => {
                  const progressPercent = Math.round(
                    (entry.currentStage / entry.caseFile.maxStage) * 100
                  );

                  return (
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

                        <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-amber-400"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>

                        <div className="mt-3 text-sm text-zinc-400">
                          Stage {entry.currentStage}/{entry.caseFile.maxStage}
                        </div>

                        <Link
                          href={`/bureau/cases/${entry.caseFile.slug}`}
                          className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 font-semibold text-zinc-950 transition hover:bg-zinc-200"
                        >
                          Open Workspace
                        </Link>
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-12">
            <Reveal>
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Solved Cases
              </div>
              <h2 className="mt-4 text-3xl font-semibold text-white">
                Completed archive
              </h2>
            </Reveal>

            {solvedCases.length === 0 ? (
              <Reveal delay={0.05}>
                <div className="mt-6 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
                  <p className="text-base leading-8 text-zinc-300">
                    No solved cases yet.
                  </p>
                </div>
              </Reveal>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {solvedCases.map((entry, index) => (
                  <Reveal key={entry.id} delay={index * 0.06}>
                    <div className="rounded-[2rem] border border-emerald-500/20 bg-zinc-900 p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                          Solved File
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
                          className="rounded-2xl bg-emerald-500 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-emerald-400"
                        >
                          Open Debrief
                        </Link>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            )}
          </div>

          {latestSolved ? (
            <Reveal delay={0.15}>
              <div className="mt-12 rounded-[2rem] border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-8">
                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                  Latest solved
                </div>
                <h2 className="mt-4 text-3xl font-semibold text-white">
                  {latestSolved.caseFile.title}
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-zinc-300">
                  Your most recently completed case is now archived and ready for debrief review.
                </p>

                <Link
                  href={`/bureau/cases/${latestSolved.caseFile.slug}/debrief`}
                  className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 font-semibold text-zinc-950 transition hover:bg-zinc-200"
                >
                  View Latest Debrief
                </Link>
              </div>
            </Reveal>
          ) : null}
        </div>
      </section>
    </main>
  );
}