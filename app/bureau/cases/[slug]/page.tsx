import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Reveal from "@/components/ui/Reveal";
import TheorySubmissionForm from "@/components/bureau/TheorySubmissionForm";
import CheckpointForm from "@/components/bureau/CheckpointForm";
import { CASE_STATUS_LABEL, THEORY_RESULT_LABEL } from "@/lib/labels";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function BureauCasePage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  const userId = Number((session?.user as { id?: string } | undefined)?.id);

  if (!Number.isInteger(userId)) {
    notFound();
  }

  const ownedCase = await prisma.userCase.findFirst({
    where: {
      userId,
      caseFile: { slug },
    },
    include: {
      caseFile: {
        include: {
          people: { orderBy: { sortOrder: "asc" } },
          records: { orderBy: { sortOrder: "asc" } },
          hints: {
            orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
          },
          checkpoints: {
            orderBy: { stage: "asc" },
          },
        },
      },
    },
  });

  if (!ownedCase) {
    // Slug may be a retired oldSlug from a renamed case. If so, redirect
    // to the case's current slug. Visiting the new URL re-runs ownership
    // resolution so users who don't own the case still see notFound from
    // the next render.
    const historyRow = await prisma.caseSlugHistory.findUnique({
      where: { oldSlug: slug },
      include: { caseFile: { select: { slug: true } } },
    });
    if (historyRow) {
      redirect(`/bureau/cases/${historyRow.caseFile.slug}`);
    }
    notFound();
  }

  const recentSubmissions = await prisma.theorySubmission.findMany({
    where: {
      userId,
      caseFileId: ownedCase.caseFileId,
    },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  const { caseFile, currentStage, status } = ownedCase;

  const visiblePeople = caseFile.people.filter(
    (person) => person.unlockStage <= currentStage
  );
  const visibleRecords = caseFile.records.filter(
    (record) => record.unlockStage <= currentStage
  );
  const visibleHints = caseFile.hints.filter(
    (hint) => hint.unlockStage <= currentStage
  );

  const currentCheckpoint =
    currentStage < caseFile.maxStage
      ? caseFile.checkpoints.find((checkpoint) => checkpoint.stage === currentStage)
      : null;

  const remainingPeople = caseFile.people.length - visiblePeople.length;
  const remainingRecords = caseFile.records.length - visibleRecords.length;
  const remainingHints = caseFile.hints.length - visibleHints.length;

  const theoryUnlocked = currentStage >= caseFile.maxStage;
  const progressPercent = Math.round((currentStage / caseFile.maxStage) * 100);

  return (
    <main className="bg-zinc-950 text-white">
      <section className="border-b border-zinc-900 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
  <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
    Case Workspace
  </div>
  <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
    {caseFile.title}
  </h1>
  <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-300">
    {caseFile.summary}
  </p>

  <div className="mt-8 flex flex-wrap gap-3">
    <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
      Stage {currentStage}/{caseFile.maxStage}
    </span>
    <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
      {CASE_STATUS_LABEL[status]}
    </span>
    <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
      {caseFile.players}
    </span>
    <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
      {caseFile.duration}
    </span>
    <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
      {caseFile.difficulty}
    </span>
  </div>

  <div className="mt-8 flex flex-wrap gap-4">
    <Link
      href={`/bureau/cases/${slug}/database`}
      className="rounded-2xl bg-white px-5 py-3 font-semibold text-zinc-950 transition hover:bg-zinc-200"
    >
      Open Bureau Database
    </Link>

    {status === "SOLVED" ? (
      <Link
        href={`/bureau/cases/${slug}/debrief`}
        className="rounded-2xl border border-emerald-500/30 px-5 py-3 font-semibold text-emerald-400 transition hover:bg-emerald-500/10"
      >
        Open Debrief
      </Link>
    ) : null}
  </div>
</Reveal>

          {status === "SOLVED" ? (
            <Reveal delay={0.06}>
              <div className="mt-8 rounded-[2rem] border border-emerald-500/30 bg-emerald-500/10 p-8">
                <div className="text-xs uppercase tracking-[0.3em] text-emerald-400">
                  Solved
                </div>
                <h2 className="mt-4 text-3xl font-semibold text-white">
                  Case resolved successfully
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-zinc-300">
                  Your final theory matched the expected suspect, motive, and evidence strongly enough to resolve the case.
                </p>

                <Link
                  href={`/bureau/cases/${slug}/debrief`}
                  className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 font-semibold text-zinc-950 transition hover:bg-zinc-200"
                >
                  Open Debrief
                </Link>
              </div>
            </Reveal>
          ) : null}

          <Reveal delay={0.08}>
            <div className="mt-8 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
              <div className="text-sm text-zinc-400">Review progress</div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-amber-400"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="mt-3 text-sm text-zinc-400">
                {progressPercent}% of stages unlocked
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {currentCheckpoint ? (
        <section className="border-b border-zinc-900 py-16">
          <div className="mx-auto max-w-6xl px-6">
            <Reveal>
              <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                  Stage {currentStage} Checkpoint
                </div>
                <h2 className="mt-4 text-3xl font-semibold text-white">
                  Clear this checkpoint to unlock the next stage
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-8 text-zinc-300">
                  Progression is tied to case understanding, not manual advancement.
                </p>

                <div className="mt-8">
                  <CheckpointForm
                    slug={slug}
                    prompt={currentCheckpoint.prompt}
                  />
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      ) : null}

      <section className="border-b border-zinc-900 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                People of Interest
              </div>
              {remainingPeople > 0 ? (
                <div className="text-sm text-zinc-500">
                  {remainingPeople} more will unlock later
                </div>
              ) : null}
            </div>
          </Reveal>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {visiblePeople.map((person, index) => (
              <Reveal key={person.id} delay={index * 0.05}>
                <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
                  <div className="text-sm text-zinc-400">{person.role}</div>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    {person.name}
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-zinc-300">
                    {person.summary}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-900 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Case Records
              </div>
              {remainingRecords > 0 ? (
                <div className="text-sm text-zinc-500">
                  {remainingRecords} more will unlock later
                </div>
              ) : null}
            </div>
          </Reveal>

          <div className="mt-6 grid gap-4">
            {visibleRecords.map((record, index) => (
              <Reveal key={record.id} delay={index * 0.05}>
                <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
  <div className="text-sm uppercase tracking-[0.2em] text-zinc-500">
    {record.category}
  </div>
  <h2 className="mt-3 text-2xl font-semibold text-white">
    {record.title}
  </h2>
  <p className="mt-4 text-sm leading-7 text-zinc-300">
    {record.summary}
  </p>

  <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm leading-7 text-zinc-400">
    {record.body}
  </div>

  <Link
    href={`/bureau/cases/${slug}/records/${record.id}`}
    className="mt-5 inline-flex rounded-2xl border border-zinc-700 px-5 py-3 font-semibold text-white transition hover:bg-zinc-950"
  >
    Open Record Detail
  </Link>
</div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-900 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Bureau Hints
              </div>
              {remainingHints > 0 ? (
                <div className="text-sm text-zinc-500">
                  {remainingHints} more will unlock later
                </div>
              ) : null}
            </div>
          </Reveal>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {visibleHints.map((hint, index) => (
              <Reveal key={hint.id} delay={index * 0.05}>
                <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
                  <div className="text-xs uppercase tracking-[0.25em] text-amber-300">
                    Level {hint.level}
                  </div>
                  <h2 className="mt-4 text-xl font-semibold text-white">
                    {hint.title}
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-zinc-300">
                    {hint.content}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 lg:grid-cols-[1fr_0.9fr]">
          <Reveal>
            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Final Theory
              </div>
              <h2 className="mt-4 text-3xl font-semibold text-white">
                Submit your current conclusion
              </h2>

              {theoryUnlocked ? (
                <>
                  <p className="mt-4 text-sm leading-8 text-zinc-300">
                    Final-stage review is unlocked. Your submission will now be scored and receive structured feedback.
                  </p>
                  <div className="mt-8">
                    <TheorySubmissionForm slug={slug} />
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm leading-8 text-zinc-300">
                  Theory submission unlocks only after you clear all progression checkpoints.
                </p>
              )}
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Recent Submissions
              </div>
              <h2 className="mt-4 text-3xl font-semibold text-white">
                Your latest attempts
              </h2>

              {recentSubmissions.length === 0 ? (
                <p className="mt-6 text-sm leading-7 text-zinc-300">
                  No theory submissions yet.
                </p>
              ) : (
                <div className="mt-6 space-y-4">
                  {recentSubmissions.map((submission) => {
                    const badgeColor =
                      submission.resultLabel === "CORRECT"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : submission.resultLabel === "PARTIAL"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                        : "border-red-500/30 bg-red-500/10 text-red-400";

                    return (
                      <div
                        key={submission.id}
                        className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm text-zinc-400">Suspect</div>
                          <span className={`rounded-full border px-3 py-1 text-xs ${badgeColor}`}>
                            {THEORY_RESULT_LABEL[submission.resultLabel]}
                          </span>
                        </div>

                        <div className="mt-1 text-lg font-semibold text-white">
                          {submission.suspectName}
                        </div>

                        <div className="mt-3 text-sm text-zinc-400">
                          Score
                        </div>
                        <div className="mt-1 text-sm text-zinc-300">
                          {submission.score}/3
                        </div>

                        <div className="mt-3 text-sm text-zinc-400">
                          Feedback
                        </div>
                        <div className="mt-1 text-sm leading-7 text-zinc-300">
                          {submission.feedback}
                        </div>

                        <div className="mt-3 text-sm text-zinc-400">
                          Submitted
                        </div>
                        <div className="mt-1 text-sm text-zinc-300">
                          {submission.createdAt.toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}