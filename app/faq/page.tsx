export default function FAQPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-24">
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">
          FAQ
        </div>
        <h1 className="mt-4 text-4xl font-semibold">Common questions</h1>

        <div className="mt-10 space-y-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-xl font-semibold">Do I need internet access?</h2>
            <p className="mt-3 leading-7 text-zinc-300">
              Yes. The physical file is the core experience, and the digital portal
              adds records, hints, and final review submission.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-xl font-semibold">Can I play alone?</h2>
            <p className="mt-3 leading-7 text-zinc-300">
              Yes. The case is designed for solo investigators as well as groups.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}