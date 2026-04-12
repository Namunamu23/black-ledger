import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Reveal from "@/components/ui/Reveal";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function CaseDebriefPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  const userId = Number((session?.user as { id?: string } | undefined)?.id);

  if (!Number.isInteger(userId)) {
    notFound();
  }

  const solvedCase = await prisma.userCase.findFirst({
    where: {
      userId,
      status: "SOLVED",
      caseFile: { slug },
    },
    include: {
      caseFile: true,
    },
  });

  if (!solvedCase) {
    notFound();
  }

  const { caseFile } = solvedCase;

  return (
    <main className="bg-zinc-950 text-white">
      <section className="border-b border-zinc-900 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal>
            <div className="text-xs uppercase tracking-[0.3em] text-emerald-400">
              Case Solved
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {caseFile.title} — Debrief
            </h1>
            <p className="mt-5 text-lg leading-8 text-zinc-300">
              {caseFile.debriefOverview}
            </p>
          </Reveal>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto grid max-w-5xl gap-6 px-6">
          <Reveal>
            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                What happened
              </div>
              <p className="mt-4 text-base leading-8 text-zinc-300">
                {caseFile.debriefWhatHappened}
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Why the robbery theory failed
              </div>
              <p className="mt-4 text-base leading-8 text-zinc-300">
                {caseFile.debriefWhyItWorked}
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Closing notes
              </div>
              <p className="mt-4 text-base leading-8 text-zinc-300">
                {caseFile.debriefClosing}
              </p>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}