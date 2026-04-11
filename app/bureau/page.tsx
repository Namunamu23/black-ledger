import Link from "next/link";
import SectionHeader from "@/components/ui/SectionHeader";
import Reveal from "@/components/ui/Reveal";
import { siteConfig } from "@/data/site";

export default function BureauPage() {
  return (
    <main className="bg-zinc-950 text-white">
      <section className="relative overflow-hidden border-b border-zinc-900 py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),transparent_30%)]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <Reveal>
            <SectionHeader
              eyebrow={siteConfig.portal.eyebrow}
              title={siteConfig.portal.title}
              text={siteConfig.portal.text}
            />
          </Reveal>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {siteConfig.portal.modules.map((module, index) => (
              <Reveal key={module.title} delay={index * 0.06}>
                <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
                  <h2 className="text-xl font-semibold text-white">{module.title}</h2>
                  <p className="mt-4 text-sm leading-7 text-zinc-300">
                    {module.text}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.2}>
            <div className="mt-10 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div>
                  <h3 className="text-2xl font-semibold text-white">
                    Built as a long-term product layer
                  </h3>
                  <p className="mt-4 max-w-2xl text-base leading-8 text-zinc-300">
                    The bureau is one of the core differentiators of the product. It gives the physical case a digital system for review, structure, and future continuity without turning the experience into a generic app.
                  </p>
                </div>

                <div className="flex flex-wrap gap-4 lg:justify-end">
                  <Link
                    href="/login"
                    className="inline-flex items-center rounded-2xl bg-white px-6 py-3 font-semibold text-zinc-950 transition hover:bg-zinc-200"
                  >
                    Log In
                  </Link>
                  <Link
                    href={siteConfig.featuredCase.href}
                    className="inline-flex items-center rounded-2xl border border-zinc-700 px-6 py-3 font-semibold text-white transition hover:bg-zinc-900"
                  >
                    View Case 001
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