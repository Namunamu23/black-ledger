export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
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
          <button className="rounded-2xl bg-amber-400 px-6 py-3 font-semibold text-zinc-950 transition hover:bg-amber-300">
            Shop Case 001
          </button>

          <button className="rounded-2xl border border-zinc-700 px-6 py-3 font-semibold text-white transition hover:bg-zinc-900">
            Learn How It Works
          </button>
        </div>
      </div>
    </main>
  );
}