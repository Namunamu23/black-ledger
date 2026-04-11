import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <section className="border-b border-zinc-900">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            Black Ledger
          </div>

          <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-tight sm:text-6xl">
            Open the file. Enter the bureau. Solve what they missed.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
            Premium physical case files with digital bureau access for immersive
            at-home investigations.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/cases/alder-street-review"
              className="rounded-2xl bg-amber-400 px-6 py-3 font-semibold text-zinc-950 transition hover:bg-amber-300"
            >
              Shop Case 001
            </Link>

            <Link
              href="/how-it-works"
              className="rounded-2xl border border-zinc-700 px-6 py-3 font-semibold text-white transition hover:bg-zinc-900"
            >
              Learn How It Works
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-900">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
            Featured File
          </div>
          <h2 className="mt-4 text-3xl font-semibold">Case 001: The Alder Street Review</h2>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-300">
            A city compliance investigator dies near a municipal parking structure.
            The original case drifted toward a simple robbery narrative. Your review
            suggests the evidence tells a different story.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="text-sm text-zinc-400">Players</div>
              <div className="mt-2 text-xl font-semibold">1–4</div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="text-sm text-zinc-400">Duration</div>
              <div className="mt-2 text-xl font-semibold">90–150 min</div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="text-sm text-zinc-400">Difficulty</div>
              <div className="mt-2 text-xl font-semibold">Moderate</div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
            Why It Feels Different
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="text-xl font-semibold">Physical evidence pack</h3>
              <p className="mt-3 leading-7 text-zinc-300">
                Reports, statements, photographs, maps, and supporting records
                designed to feel deliberate and believable.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="text-xl font-semibold">Digital bureau portal</h3>
              <p className="mt-3 leading-7 text-zinc-300">
                Search records, review profiles, use structured hints, and submit
                your final theory in a serious review system.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}