import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Reveal from "@/components/ui/Reveal";
import TheorySubmissionForm from "@/components/bureau/TheorySubmissionForm";

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
        },
      },
    },
  });

  if (!ownedCase) {
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

  const { caseFile } = ownedCase;

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
                {caseFile.players}
              </span>
              <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
                {caseFile.duration}
              </span>
              <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
                {caseFile.difficulty}
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-b border-zinc-900 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              People of Interest
            </div>
          </Reveal>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {caseFile.people.map((person, index) => (
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
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              Case Records
            </div>
          </Reveal>

          <div className="mt-6 grid gap-4">
            {caseFile.records.map((record, index) => (
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
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-900 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              Bureau Hints
            </div>
          </Reveal>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {caseFile.hints.map((hint, index) => (
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
              <p className="mt-4 text-sm leading-8 text-zinc-300">
                This creates a real database-backed submission tied to the logged-in user and this specific case.
              </p>

              <div className="mt-8">
                <TheorySubmissionForm slug={slug} />
              </div>
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
                  {recentSubmissions.map((submission) => (
                    <div
                      key={submission.id}
                      className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
                    >
                      <div className="text-sm text-zinc-400">
                        Suspect
                      </div>
                      <div className="mt-1 text-lg font-semibold text-white">
                        {submission.suspectName}
                      </div>
                      <div className="mt-3 text-sm text-zinc-400">
                        Submitted
                      </div>
                      <div className="mt-1 text-sm text-zinc-300">
                        {submission.createdAt.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}