export default function CasePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">
          Case 001
        </div>
        <h1 className="mt-4 text-4xl font-semibold">
          The Alder Street Review
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-300">
          A city compliance investigator dies near a municipal parking structure.
          The case drifted toward a simple robbery narrative. Your bureau review
          suggests the evidence tells another story.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
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
    </main>
  );
}