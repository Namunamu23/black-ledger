"use client";

import { useEffect } from "react";
import Link from "next/link";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Surface to whatever logging the operator has wired. Today: Vercel
    // function logs. After Sentry lands: switch to a captureException call.
    console.error("[bureau:error]", error);
  }, [error]);

  return (
    <main className="relative min-h-screen bg-[#050507] text-zinc-100">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(185,28,28,0.18),transparent_28%),linear-gradient(to_bottom,#050507,#09090b_50%,#030304)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-3xl px-6 py-24">
        <div className="text-xs uppercase tracking-[0.3em] text-red-400">
          System Fault
        </div>

        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white">
          The bureau ran into an unexpected fault
        </h1>

        <p className="mt-6 text-base leading-8 text-zinc-300">
          The action could not be completed. The fault has been logged for
          review. You can retry or return to the bureau.
        </p>

        {error.digest ? (
          <p className="mt-4 font-mono text-xs text-zinc-500">
            Reference: {error.digest}
          </p>
        ) : null}

        <div className="mt-10 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={reset}
            className="rounded-2xl bg-amber-400 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-amber-300"
          >
            Retry
          </button>
          <Link
            href="/bureau"
            className="rounded-2xl border border-zinc-700 px-5 py-3 font-semibold text-white transition hover:bg-zinc-900"
          >
            Return to Bureau
          </Link>
        </div>
      </div>
    </main>
  );
}
