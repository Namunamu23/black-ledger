import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Reveal from "@/components/ui/Reveal";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function PublicCasePage({ params }: PageProps) {
  const { slug } = await params;

  const caseFile = await prisma.caseFile.findUnique({
    where: { slug },
  });

  if (!caseFile || !caseFile.isActive) {
    notFound();
  }

  return (
    <main className="bg-zinc-950 text-white">
      <section className="border-b border-zinc-900 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              Case Detail
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

          <Reveal delay={0.08}>
            <div className="mt-10 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
              <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                    What to expect
                  </div>
                  <p className="mt-4 text-base leading-8 text-zinc-300">
                    Each Black Ledger file is designed as a premium at-home investigation with staged content, bureau progression, and a structured final theory review.
                  </p>
                </div>

                <div className="flex flex-wrap gap-4 lg:justify-end">
                  <Link
                    href="/login"
                    className="rounded-2xl bg-white px-5 py-3 font-semibold text-zinc-950 transition hover:bg-zinc-200"
                  >
                    Sign in to Bureau
                  </Link>
                  <Link
                    href="/cases"
                    className="rounded-2xl border border-zinc-700 px-5 py-3 font-semibold text-white transition hover:bg-zinc-900"
                  >
                    Back to Catalog
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}