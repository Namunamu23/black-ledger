export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-24">
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">
          How It Works
        </div>
        <h1 className="mt-4 text-4xl font-semibold">
          A serious case experience in three steps
        </h1>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-xl font-semibold">1. Receive the file</h2>
            <p className="mt-3 leading-7 text-zinc-300">
              Your case arrives with evidence and supporting materials.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-xl font-semibold">2. Review the evidence</h2>
            <p className="mt-3 leading-7 text-zinc-300">
              Compare statements, timelines, and records carefully.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-xl font-semibold">3. Enter the bureau</h2>
            <p className="mt-3 leading-7 text-zinc-300">
              Access guidance, records, and submit your final theory.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}