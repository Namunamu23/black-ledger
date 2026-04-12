import Link from "next/link";
import { prisma } from "@/lib/prisma";
import SectionHeader from "@/components/ui/SectionHeader";
import Reveal from "@/components/ui/Reveal";

export default async function CasesPage() {
  const cases = await prisma.caseFile.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="bg-zinc-950 text-white">
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <SectionHeader
              eyebrow="Cases"
              title="The Black Ledger catalog"
              text="A growing archive of premium investigative experiences, each built around physical evidence, bureau review, and structured case progression."
            />
          </Reveal>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {cases.map((caseFile, index) => (
              <Reveal key={caseFile.id} delay={index * 0.06}>
                <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
                  <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                    Case File
                  </div>

                  <h2 className="mt-4 text-3xl font-semibold text-white">
                    {caseFile.title}
                  </h2>

                  <p className="mt-4 text-sm leading-7 text-zinc-300">
                    {caseFile.summary}
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
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

                  <Link
                    href={`/cases/${caseFile.slug}`}
                    className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 font-semibold text-zinc-950 transition hover:bg-zinc-200"
                  >
                    View Case
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}