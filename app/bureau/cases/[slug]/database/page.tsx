import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Reveal from "@/components/ui/Reveal";
import CaseDatabaseSearch from "@/components/bureau/CaseDatabaseSearch";
import { CASE_STATUS_LABEL } from "@/lib/labels";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function CaseDatabasePage({ params }: PageProps) {
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
        },
      },
    },
  });

  if (!ownedCase) {
    notFound();
  }

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

  return (
    <main className="bg-zinc-950 text-white">
      <section className="border-b border-zinc-900 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              Bureau Database
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {caseFile.title}
            </h1>

            <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-300">
              Search the unlocked case database for people, evidence records,
              and bureau hints.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
                Stage {currentStage}/{caseFile.maxStage}
              </span>

              <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
                {CASE_STATUS_LABEL[status]}
              </span>

              <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
                {visiblePeople.length} people
              </span>

              <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
                {visibleRecords.length} records
              </span>
            </div>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href={`/bureau/cases/${slug}`}
                className="rounded-2xl border border-zinc-700 px-5 py-3 font-semibold text-white transition hover:bg-zinc-900"
              >
                Back to Workspace
              </Link>

              {status === "SOLVED" ? (
                <Link
                  href={`/bureau/cases/${slug}/debrief`}
                  className="rounded-2xl bg-emerald-500 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-emerald-400"
                >
                  Open Debrief
                </Link>
              ) : null}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <CaseDatabaseSearch
              slug={slug}
              currentStage={currentStage}
              people={visiblePeople}
              records={visibleRecords}
              hints={visibleHints}
            />
          </Reveal>
        </div>
      </section>
    </main>
  );
}