import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import SectionHeader from "@/components/ui/SectionHeader";
import Reveal from "@/components/ui/Reveal";
import SignOutButton from "@/components/auth/SignOutButton";
import CaseActivationForm from "@/components/bureau/CaseActivationForm";

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
              title="Protected review access"
              text="Your bureau is now account-aware. Activated cases appear below with visible progression status and protected workspaces."
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
                  <SignOutButton />
                </div>
              </div>
            </div>
          </Reveal>

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

          <div className="mt-10">
            <Reveal delay={0.16}>
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Your Archive
              </div>
              <h2 className="mt-4 text-3xl font-semibold text-white">
                Owned cases
              </h2>
            </Reveal>

            {ownedCases.length === 0 ? (
              <Reveal delay={0.2}>
                <div className="mt-6 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
                  <p className="text-base leading-8 text-zinc-300">
                    You have not activated any cases yet.
                  </p>
                </div>
              </Reveal>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {ownedCases.map((entry, index) => {
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
                          <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
                            Stage {entry.currentStage}/{entry.caseFile.maxStage}
                          </span>
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
                          {progressPercent}% of review stages unlocked
                        </div>

                        <div className="mt-6 flex flex-wrap gap-3">
                          <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
                            {entry.caseFile.players}
                          </span>
                          <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
                            {entry.caseFile.duration}
                          </span>
                          <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
                            {entry.caseFile.difficulty}
                          </span>
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
        </div>
      </section>
    </main>
  );
}