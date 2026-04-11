import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center bg-zinc-950 text-white">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
          Not Found
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          This file does not exist in the archive.
        </h1>
        <p className="mt-6 text-lg leading-8 text-zinc-300">
          The page you tried to access could not be found. Return to the main archive and continue your review from there.
        </p>

        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/"
            className="rounded-2xl bg-white px-6 py-3 font-semibold text-zinc-950 transition hover:bg-zinc-200"
          >
            Go Home
          </Link>
          <Link
            href="/bureau"
            className="rounded-2xl border border-zinc-700 px-6 py-3 font-semibold text-white transition hover:bg-zinc-900"
          >
            Open Bureau
          </Link>
        </div>
      </div>
    </main>
  );
}