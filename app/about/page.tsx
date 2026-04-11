import SectionHeader from "@/components/ui/SectionHeader";

export default function AboutPage() {
  return (
    <main className="bg-zinc-950 text-white">
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeader
            eyebrow="About"
            title="Built around realism and investigative immersion"
            text="Black Ledger is designed for people who want a smarter, more believable case experience. The goal is not random complexity. The goal is a file that feels worth studying."
          />

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="text-xl font-semibold text-white">Realism</h3>
              <p className="mt-4 text-sm leading-7 text-zinc-300">
                Evidence, structure, and tone are designed to feel deliberate and credible.
              </p>
            </div>

            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="text-xl font-semibold text-white">Coherence</h3>
              <p className="mt-4 text-sm leading-7 text-zinc-300">
                Clues, motives, and reveals should connect cleanly and reward attention.
              </p>
            </div>

            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="text-xl font-semibold text-white">Continuity</h3>
              <p className="mt-4 text-sm leading-7 text-zinc-300">
                The long-term vision is a growing archive of connected and standalone bureau files.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}