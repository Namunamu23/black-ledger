import Link from "next/link";
import {
  ArrowRight,
  Database,
  FileText,
  Search,
  ShieldCheck,
} from "lucide-react";
import SectionHeader from "@/components/ui/SectionHeader";
import InfoCard from "@/components/ui/InfoCard";
import Reveal from "@/components/ui/Reveal";
import { siteConfig } from "@/data/site";

export default function HomePage() {
  const { featuredCase, home } = siteConfig;

  return (
    <main className="bg-zinc-950 text-white">
      <section className="relative overflow-hidden border-b border-zinc-900">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_30%),radial-gradient(circle_at_right,rgba(255,255,255,0.05),transparent_25%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-24 lg:grid-cols-[1.05fr_0.95fr] lg:py-32">
          <Reveal>
            <div className="max-w-2xl">
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                {siteConfig.brand.name}
              </div>

              <h1 className="mt-6 text-5xl font-semibold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
                {home.heroTitle}
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-300">
                {home.heroText}
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href={featuredCase.href}
                  className="inline-flex items-center rounded-2xl bg-amber-400 px-6 py-3 font-semibold text-zinc-950 transition hover:bg-amber-300"
                >
                  Shop Case 001
                </Link>
                <Link
                  href="/bureau"
                  className="inline-flex items-center rounded-2xl border border-zinc-700 px-6 py-3 font-semibold text-white transition hover:bg-zinc-900"
                >
                  View Bureau System
                </Link>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <InfoCard label="Players" value={featuredCase.players} />
                <InfoCard label="Duration" value={featuredCase.duration} />
                <InfoCard label="Difficulty" value={featuredCase.difficulty} />
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="lg:pl-6">
              <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-5 shadow-2xl shadow-black/30">
                <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950 p-6">
                  <div className="flex items-start justify-between border-b border-zinc-800 pb-5">
                    <div>
                      <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                        Bureau Console
                      </div>
                      <h2 className="mt-3 text-2xl font-semibold text-white">
                        Active Review
                      </h2>
                      <p className="mt-2 text-sm leading-7 text-zinc-400">
                        Case {featuredCase.id}: {featuredCase.title}
                      </p>
                    </div>
                    <div className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-amber-300">
                      Open File
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                      <Search className="h-5 w-5 text-amber-300" />
                      <div className="mt-4 text-base font-semibold text-white">
                        Review contradictions
                      </div>
                      <p className="mt-2 text-sm leading-7 text-zinc-400">
                        Compare statements, timings, and movement records.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                      <Database className="h-5 w-5 text-amber-300" />
                      <div className="mt-4 text-base font-semibold text-white">
                        Search bureau records
                      </div>
                      <p className="mt-2 text-sm leading-7 text-zinc-400">
                        Access profiles, supporting entries, and internal review tools.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                      <FileText className="h-5 w-5 text-amber-300" />
                      <div className="mt-4 text-base font-semibold text-white">
                        File your theory
                      </div>
                      <p className="mt-2 text-sm leading-7 text-zinc-400">
                        Submit motive, responsible party, and supporting evidence.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                      <ShieldCheck className="h-5 w-5 text-amber-300" />
                      <div className="mt-4 text-base font-semibold text-white">
                        Reclassify the case
                      </div>
                      <p className="mt-2 text-sm leading-7 text-zinc-400">
                        Determine what the original investigation failed to connect.
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/bureau"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-zinc-200 transition hover:text-white"
                  >
                    Open Bureau Overview <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-b border-zinc-900 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <SectionHeader
              eyebrow="Featured File"
              title={`Case ${featuredCase.id}: ${featuredCase.title}`}
              text={featuredCase.summary}
            />
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <Reveal><InfoCard label="Players" value={featuredCase.players} /></Reveal>
            <Reveal delay={0.05}><InfoCard label="Duration" value={featuredCase.duration} /></Reveal>
            <Reveal delay={0.1}><InfoCard label="Difficulty" value={featuredCase.difficulty} /></Reveal>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-900 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <SectionHeader
              eyebrow="Why It Feels Different"
              title="Built to feel more deliberate than a standard mystery box"
              text="The goal is not random complexity. The goal is a premium, believable, and well-structured investigation experience."
            />
          </Reveal>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {home.differentiators.map((item, index) => (
              <Reveal key={item.title} delay={index * 0.06}>
                <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
                  <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-zinc-300">{item.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="rounded-[2rem] border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-8 sm:p-10">
              <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                    Start With Case 001
                  </div>
                  <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    A premium foundation for the Black Ledger archive.
                  </h2>
                  <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-300">
                    Begin with the first file and follow the brand as future reviews, continuity threads, and new bureau cases expand over time.
                  </p>
                </div>

                <div className="flex flex-wrap gap-4 lg:justify-end">
                  <Link
                    href={featuredCase.href}
                    className="inline-flex items-center rounded-2xl bg-amber-400 px-6 py-3 font-semibold text-zinc-950 transition hover:bg-amber-300"
                  >
                    Shop Case 001
                  </Link>
                  <Link
                    href="/about"
                    className="inline-flex items-center rounded-2xl border border-zinc-700 px-6 py-3 font-semibold text-white transition hover:bg-zinc-900"
                  >
                    Learn About Black Ledger
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