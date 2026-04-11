import SectionHeader from "@/components/ui/SectionHeader";
import { siteConfig } from "@/data/site";

export default function HowItWorksPage() {
  return (
    <main className="bg-zinc-950 text-white">
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeader
            eyebrow="How It Works"
            title="A serious case experience in three steps"
            text="The process is intentionally simple to start, but deep enough to feel satisfying. The physical file and digital bureau work together as one experience."
          />

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {siteConfig.home.howSteps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6"
              >
                <div className="text-xs uppercase tracking-[0.3em] text-amber-300">
                  0{index + 1}
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-white">
                  {step.title}
                </h2>
                <p className="mt-4 text-sm leading-8 text-zinc-300">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}