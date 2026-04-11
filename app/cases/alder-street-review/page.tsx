import Link from "next/link";
import SectionHeader from "@/components/ui/SectionHeader";
import InfoCard from "@/components/ui/InfoCard";
import { siteConfig } from "@/data/site";

export default function CasePage() {
  const featuredCase = siteConfig.featuredCase;

  return (
    <main className="bg-zinc-950 text-white">
      <section className="border-b border-zinc-900 py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <SectionHeader
              eyebrow={`Case ${featuredCase.id}`}
              title={featuredCase.title}
              text={featuredCase.summary}
            />

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <InfoCard label="Players" value={featuredCase.players} />
              <InfoCard label="Duration" value={featuredCase.duration} />
              <InfoCard label="Difficulty" value={featuredCase.difficulty} />
            </div>
          </div>

          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              Case Format
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-white">
              Physical file + digital bureau access
            </h2>
            <p className="mt-4 text-sm leading-8 text-zinc-300">
              Review a structured evidence pack, compare timelines and statements,
              and use the bureau portal to support your final review.
            </p>

            <div className="mt-8 space-y-3 text-sm leading-7 text-zinc-300">
              <div>Case summary and incident report</div>
              <div>Statements, records, and evidence materials</div>
              <div>Guided hints and bureau review structure</div>
              <div>Final theory submission workflow</div>
            </div>

            <button className="mt-8 w-full rounded-2xl bg-amber-400 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-amber-300">
              Add to Cart
            </button>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-900 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
              <h3 className="text-2xl font-semibold text-white">
                What makes this case work
              </h3>
              <p className="mt-4 text-base leading-8 text-zinc-300">
                The Alder Street Review is designed to feel grounded and rewarding. It is not built around a cheap twist. It is built around motive, contradiction, and careful evidence review.
              </p>
            </div>

            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
              <h3 className="text-2xl font-semibold text-white">
                Best for
              </h3>
              <p className="mt-4 text-base leading-8 text-zinc-300">
                True crime fans, mystery lovers, couples, and small groups who want a premium at-home case experience rather than a casual board game.
              </p>
            </div>
          </div>

          <div className="mt-10">
            <Link
              href="/how-it-works"
              className="inline-flex rounded-2xl border border-zinc-700 px-6 py-3 font-semibold text-white transition hover:bg-zinc-900"
            >
              See How It Works
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}