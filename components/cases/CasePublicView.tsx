import Link from "next/link";

type CasePublicViewProps = {
  caseFile: {
    title: string;
    slug: string;
    summary: string;
    players: string;
    duration: string;
    difficulty: string;
  };
  previewMode?: boolean;
  adminBackHref?: string;
};

export default function CasePublicView({
  caseFile,
  previewMode = false,
  adminBackHref,
}: CasePublicViewProps) {
  return (
    <main className="bg-zinc-950 text-white">
      <section className="border-b border-zinc-900 py-20">
        <div className="mx-auto max-w-6xl px-6">
          {previewMode ? (
            <div className="mb-8 rounded-[2rem] border border-amber-500/30 bg-amber-500/10 p-6">
              <div className="text-xs uppercase tracking-[0.3em] text-amber-300">
                Admin Preview
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300">
                You are previewing this case as it would appear publicly, even if it is still unpublished.
              </p>

              {adminBackHref ? (
                <Link
                  href={adminBackHref}
                  className="mt-4 inline-flex rounded-2xl border border-zinc-700 px-5 py-3 font-semibold text-white transition hover:bg-zinc-900"
                >
                  Back to Editor
                </Link>
              ) : null}
            </div>
          ) : null}

          <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
            Case Detail
          </div>

          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            {caseFile.title}
          </h1>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-300">
            {caseFile.summary}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
              {caseFile.players}
            </span>
            <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
              {caseFile.duration}
            </span>
            <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
              {caseFile.difficulty}
            </span>
          </div>

          <div className="mt-10 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                  What to expect
                </div>
                <p className="mt-4 text-base leading-8 text-zinc-300">
                  Each Black Ledger case is built as a premium investigation experience with staged bureau progression, structured evidence review, and a final theory evaluation.
                </p>
              </div>

              <div className="flex flex-wrap gap-4 lg:justify-end">
                <Link
                  href="/login"
                  className="rounded-2xl bg-white px-5 py-3 font-semibold text-zinc-950 transition hover:bg-zinc-200"
                >
                  Sign in to Bureau
                </Link>
                <Link
                  href="/cases"
                  className="rounded-2xl border border-zinc-700 px-5 py-3 font-semibold text-white transition hover:bg-zinc-900"
                >
                  Back to Catalog
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}