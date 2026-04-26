import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import TheorySubmissionForm from "@/components/bureau/TheorySubmissionForm";
import CheckpointForm from "@/components/bureau/CheckpointForm";
import { CASE_STATUS_LABEL, THEORY_RESULT_LABEL } from "@/lib/labels";
import RevealedEvidence, {
  type ResolvedEvidence,
} from "./_components/RevealedEvidence";
import {
  Card,
  Pill,
  StampBadge,
  RedactedBar,
  TerminalReadout,
} from "@/components/ui";

const BTN_PRIMARY_SM =
  "inline-flex items-center rounded-2xl bg-amber-400 px-3 py-1.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300";
const BTN_OUTLINE_SM =
  "inline-flex items-center rounded-2xl border border-zinc-700 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-zinc-800";
const BTN_OUTLINE_MD =
  "inline-flex items-center rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800";

type UnlocksTarget = { type: string; id: number };

async function resolveEvidence(
  unlocksTarget: unknown
): Promise<ResolvedEvidence | null> {
  const target = unlocksTarget as UnlocksTarget;

  if (target?.type === "record") {
    const record = await prisma.caseRecord.findUnique({
      where: { id: target.id },
    });
    if (!record) return null;
    return {
      type: "record",
      record: { id: record.id, title: record.title, body: record.body },
    };
  }

  if (target?.type === "person") {
    const person = await prisma.casePerson.findUnique({
      where: { id: target.id },
    });
    if (!person) return null;
    return {
      type: "person",
      person: { id: person.id, name: person.name, summary: person.summary },
    };
  }

  if (target?.type === "hint") {
    const hint = await prisma.caseHint.findUnique({
      where: { id: target.id },
    });
    if (!hint) return null;
    return {
      type: "hint",
      hint: { id: hint.id, title: hint.title, content: hint.content },
    };
  }

  if (target?.type === "hidden_evidence") {
    const hiddenEvidence = await prisma.hiddenEvidence.findUnique({
      where: { id: target.id },
    });
    if (!hiddenEvidence) return null;
    return {
      type: "hidden_evidence" as const,
      hiddenEvidence: {
        id: hiddenEvidence.id,
        title: hiddenEvidence.title,
        body: hiddenEvidence.body,
        kind: hiddenEvidence.kind,
      },
    };
  }

  return null;
}

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
    if (historyRow && historyRow.caseFile.slug !== slug) {
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

  const redemptions = await prisma.accessCodeRedemption.findMany({
    where: { userId, caseFileId: ownedCase.caseFileId },
    include: { accessCode: true },
    orderBy: { redeemedAt: "asc" },
  });

  // Resolve each redemption to its actual content. Drop nulls (unknown
  // unlocksTarget types or deleted target rows) so the UI never has to
  // render placeholders for missing evidence. Use allSettled so a single
  // failed lookup doesn't fail the whole page.
  const settled = await Promise.allSettled(
    redemptions.map((r) => resolveEvidence(r.accessCode.unlocksTarget))
  );
  const revealedEvidence: ResolvedEvidence[] = settled
    .filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof resolveEvidence>>> =>
        r.status === "fulfilled"
    )
    .map((r) => r.value)
    .filter((item): item is ResolvedEvidence => item !== null);

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

  // ---- Status pill tone (UserCaseStatus → Pill tone) ----
  const statusToneMap: Record<string, "success" | "warning" | "info" | "neutral"> = {
    SOLVED: "success",
    FINAL_REVIEW: "warning",
    ACTIVE: "info",
    NOT_STARTED: "neutral",
  };
  const statusTone = statusToneMap[status] ?? "neutral";

  // ---- Theory result pill tone ----
  const resultToneMap: Record<string, "success" | "warning" | "danger"> = {
    CORRECT: "success",
    PARTIAL: "warning",
    INCORRECT: "danger",
  };

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

      <div className="relative mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Case header */}
        <Card variant="dossier" padding="none">
          <div className="border-b border-red-950/70 bg-gradient-to-r from-red-950/30 via-zinc-950 to-cyan-950/20 px-5 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_22px_rgba(239,68,68,0.95)]"
                  aria-hidden
                />
                <span className="font-mono text-[11px] uppercase tracking-[0.34em] text-red-200">
                  Case Workspace
                </span>
                <Pill tone="danger" label="Classified" />
                {status === "SOLVED" ? (
                  <StampBadge
                    label="Case Resolved"
                    tone="green"
                    size="sm"
                    rotate
                  />
                ) : null}
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                Node BLB-NY-01 / Active Review
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
              {caseSerial}
            </div>
            <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
              {caseFile.title}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
              {caseFile.summary}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Pill
                tone="warning"
                label={`Stage ${currentStage} / ${caseFile.maxStage}`}
              />
              <Pill tone={statusTone} label={CASE_STATUS_LABEL[status]} />
              <Pill tone="neutral" label={caseFile.players} />
              <Pill tone="neutral" label={caseFile.duration} />
              <Pill tone="neutral" label={caseFile.difficulty} />
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/bureau/cases/${slug}/database`}
                className={BTN_OUTLINE_SM}
              >
                Bureau Database
              </Link>
              {status === "SOLVED" ? (
                <Link
                  href={`/bureau/cases/${slug}/debrief`}
                  className="inline-flex items-center rounded-2xl border border-emerald-500/30 px-3 py-1.5 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-500/10"
                >
                  Open Debrief
                </Link>
              ) : null}
            </div>
          </div>
        </Card>

        {/* Progress + (optional) solved summary */}
        <div
          className={`mt-4 grid gap-4 ${
            status === "SOLVED" ? "md:grid-cols-2" : ""
          }`}
        >
          <Card variant="dossier" padding="md">
            <TerminalReadout
              tone="amber"
              label="STAGE PROGRESSION"
              lines={[
                `${progressPercent}% of stages unlocked — Stage ${currentStage} of ${caseFile.maxStage}`,
              ]}
            />
          </Card>

          {status === "SOLVED" ? (
            <Card
              variant="dossier"
              padding="md"
              className="border-emerald-500/20"
            >
              <Pill tone="success" label="Resolved" />
              <h2 className="mt-3 text-xl font-semibold text-white">
                Case resolved successfully
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Your final theory matched the expected suspect, motive, and
                evidence.
              </p>
              <Link
                href={`/bureau/cases/${slug}/debrief`}
                className={`mt-4 ${BTN_PRIMARY_SM}`}
              >
                Open Debrief
              </Link>
            </Card>
          ) : null}
        </div>

        {/* Checkpoint */}
        {currentCheckpoint ? (
          <div className="mt-6">
            <Card
              variant="dossier"
              padding="lg"
              className="border-amber-500/20"
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-2 w-2 rounded-full bg-amber-500"
                  aria-hidden
                />
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-amber-400">
                  Stage {currentStage} Checkpoint
                </span>
              </div>
              <h2 className="mt-4 text-2xl font-semibold text-white">
                Clear this checkpoint to unlock the next stage
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Progression is tied to case understanding, not manual
                advancement.
              </p>
              <div className="mt-6">
                <CheckpointForm
                  slug={slug}
                  prompt={currentCheckpoint.prompt}
                />
              </div>
            </Card>
          </div>
        ) : null}

        {/* Revealed evidence (renders its own section if non-empty) */}
        <RevealedEvidence items={revealedEvidence} />

        {/* People of Interest */}
        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="h-2 w-2 rounded-full bg-cyan-500"
                aria-hidden
              />
              <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
                People of Interest
              </span>
            </div>
            {remainingPeople > 0 ? (
              <span className="font-mono text-[10px] text-zinc-600">
                {remainingPeople} subjects locked
              </span>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {visiblePeople.map((person) => (
              <Card key={person.id} variant="dossier" padding="none">
                <div className="flex items-center justify-between border-b border-red-950/50 px-4 py-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-600">
                    Subject Profile
                  </span>
                  <Pill tone="neutral" label={person.role} />
                </div>
                <div className="p-4">
                  <h2 className="text-lg font-semibold text-white">
                    {person.name}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    {person.summary}
                  </p>
                </div>
              </Card>
            ))}
            {remainingPeople > 0
              ? Array.from({ length: remainingPeople }).map((_, i) => (
                  <Card
                    key={`locked-person-${i}`}
                    variant="dossier"
                    padding="md"
                  >
                    <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-700 mb-3">
                      Classified Subject
                    </div>
                    <RedactedBar width="lg" className="mb-2" />
                    <RedactedBar width="md" className="mb-3" />
                    <RedactedBar width="full" />
                    <RedactedBar width="full" className="mt-1" />
                  </Card>
                ))
              : null}
          </div>
        </div>

        {/* Case Records */}
        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="h-2 w-2 rounded-full bg-amber-500"
                aria-hidden
              />
              <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
                Case Records
              </span>
            </div>
            {remainingRecords > 0 ? (
              <span className="font-mono text-[10px] text-zinc-600">
                {remainingRecords} records locked
              </span>
            ) : null}
          </div>

          <div className="grid gap-4">
            {visibleRecords.map((record) => (
              <Card key={record.id} variant="dossier" padding="none">
                <div className="flex items-center justify-between border-b border-red-950/50 px-4 py-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-600">
                    Evidence Record
                  </span>
                  <Pill tone="neutral" label={record.category} />
                </div>
                <div className="p-4">
                  <h2 className="text-lg font-semibold text-white">
                    {record.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    {record.summary}
                  </p>
                  <TerminalReadout
                    tone="neutral"
                    label="RECORD BODY"
                    lines={record.body.split("\n").filter(Boolean)}
                    className="mt-3"
                  />
                  <Link
                    href={`/bureau/cases/${slug}/records/${record.id}`}
                    className={`mt-3 ${BTN_OUTLINE_SM}`}
                  >
                    Open Record Detail
                  </Link>
                </div>
              </Card>
            ))}
            {remainingRecords > 0
              ? Array.from({ length: remainingRecords }).map((_, i) => (
                  <Card
                    key={`locked-record-${i}`}
                    variant="dossier"
                    padding="md"
                  >
                    <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-700 mb-3">
                      Classified Record
                    </div>
                    <RedactedBar width="lg" className="mb-2" />
                    <RedactedBar width="md" className="mb-3" />
                    <RedactedBar width="full" />
                    <RedactedBar width="full" className="mt-1" />
                  </Card>
                ))
              : null}
          </div>
        </div>

        {/* Bureau Hints */}
        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="h-2 w-2 rounded-full bg-emerald-500"
                aria-hidden
              />
              <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
                Bureau Hints
              </span>
            </div>
            {remainingHints > 0 ? (
              <span className="font-mono text-[10px] text-zinc-600">
                {remainingHints} hints locked
              </span>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {visibleHints.map((hint) => (
              <Card key={hint.id} variant="dossier" padding="md">
                <Pill tone="warning" label={`Level ${hint.level}`} />
                <h2 className="mt-3 text-lg font-semibold text-white">
                  {hint.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  {hint.content}
                </p>
              </Card>
            ))}
            {remainingHints > 0
              ? Array.from({ length: remainingHints }).map((_, i) => (
                  <Card
                    key={`locked-hint-${i}`}
                    variant="dossier"
                    padding="md"
                    className="opacity-50"
                  >
                    <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-700">
                      Hint Locked
                    </div>
                    <RedactedBar width="sm" className="mt-2" />
                    <RedactedBar width="lg" className="mt-2" />
                  </Card>
                ))
              : null}
          </div>
        </div>

        {/* Final Theory + Recent Submissions */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <Card variant="dossier" padding="lg">
            <Pill
              tone={theoryUnlocked ? "success" : "neutral"}
              label={
                theoryUnlocked
                  ? "Theory Submission Unlocked"
                  : "Locked — Clear All Checkpoints"
              }
            />
            <h2 className="mt-4 text-2xl font-semibold text-white">
              Submit your current conclusion
            </h2>
            {theoryUnlocked ? (
              <>
                <p className="mt-3 text-sm leading-7 text-zinc-400">
                  Final-stage review is unlocked. Your submission will now be
                  scored and receive structured feedback.
                </p>
                <div className="mt-6">
                  <TheorySubmissionForm slug={slug} />
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                Theory submission unlocks only after you clear all progression
                checkpoints.
              </p>
            )}
          </Card>

          <Card variant="dossier" padding="lg">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
              Recent Submissions
            </div>
            <h2 className="mt-3 text-xl font-semibold text-white">
              Your latest attempts
            </h2>

            {recentSubmissions.length === 0 ? (
              <TerminalReadout
                tone="neutral"
                label="STATUS"
                lines={["No theory submissions yet."]}
                className="mt-4"
              />
            ) : (
              <div className="mt-4 space-y-4">
                {recentSubmissions.map((submission) => (
                  <div
                    key={submission.id}
                    className="rounded-2xl border border-zinc-800 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">
                        {submission.suspectName}
                      </span>
                      <Pill
                        tone={resultToneMap[submission.resultLabel] ?? "neutral"}
                        label={THEORY_RESULT_LABEL[submission.resultLabel]}
                      />
                    </div>
                    <TerminalReadout
                      tone="neutral"
                      label="SCORE"
                      lines={[`${submission.score}/3`]}
                      className="mt-3"
                    />
                    <p className="mt-2 text-sm text-zinc-400">
                      {submission.feedback}
                    </p>
                    <p className="mt-2 font-mono text-[10px] text-zinc-600">
                      {new Date(submission.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}
