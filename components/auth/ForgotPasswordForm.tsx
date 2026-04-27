"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = (await res.json()) as { message?: string };

      setStatus("sent");
      setMessage(
        data.message ??
          "If that email is registered, a reset link has been sent."
      );
    } catch {
      setStatus("idle");
      setMessage("Something went wrong. Please try again.");
    }
  }

  if (status === "sent") {
    return (
      <div className="mt-8 grid gap-4">
        <p className="text-sm leading-6 text-emerald-400">{message}</p>
        <p className="text-sm text-zinc-500">
          Check your inbox and spam folder. The link expires in 1 hour.
        </p>
        <Link href="/login" className="text-sm text-amber-400 hover:text-amber-300">
          ← Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 grid gap-4">
      <input
        type="email"
        placeholder="Email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
        required
      />

      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-2xl bg-amber-400 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === "loading" ? "Sending..." : "Send Reset Link"}
      </button>

      {message ? (
        <p className="text-sm text-red-400">{message}</p>
      ) : null}

      <Link
        href="/login"
        className="text-center text-sm text-zinc-500 hover:text-zinc-300"
      >
        ← Back to sign in
      </Link>
    </form>
  );
}
