"use client";

import { useState } from "react";

type BuyButtonProps = {
  caseId: number;
};

export default function BuyButton({ caseId }: BuyButtonProps) {
  const [step, setStep] = useState<"closed" | "open">("closed");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, email }),
      });
      const data = (await response.json()) as { url?: string; message?: string };
      if (!response.ok || !data.url) {
        setStatus("error");
        setError(data.message ?? "Could not start checkout.");
        return;
      }
      window.location.assign(data.url);
    } catch {
      setStatus("error");
      setError("Something went wrong. Please try again.");
    }
  }

  if (step === "closed") {
    return (
      <button
        type="button"
        onClick={() => setStep("open")}
        className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-amber-400 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-amber-300"
      >
        Get the kit
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
      <label className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
        Email for activation code
      </label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
        autoFocus
        className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={status === "loading"}
          className="flex-1 rounded-2xl bg-amber-400 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "loading" ? "Redirecting..." : "Continue to checkout"}
        </button>
        <button
          type="button"
          onClick={() => {
            setStep("closed");
            setStatus("idle");
            setError("");
          }}
          className="rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </form>
  );
}
