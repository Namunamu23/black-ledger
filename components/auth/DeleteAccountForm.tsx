"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export default function DeleteAccountForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  const canSubmit =
    password.length > 0 &&
    confirmation === "delete my account" &&
    status !== "loading";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmation }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        setStatus("error");
        setMessage(data.message ?? "Could not delete account.");
        return;
      }

      // Sign out and redirect home. The session cookie is now stale (the
      // User row is gone; the next auth() call would clear session.user
      // anyway via the tokenVersion-mismatch path), but signOut also
      // clears the JWT cookie cleanly. NextAuth v5 uses `redirectTo`
      // (not v4's `callbackUrl`) — this matches `components/auth/SignOutButton.tsx`.
      await signOut({ redirectTo: "/" });
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <label className="block">
        <span className="text-xs uppercase tracking-[0.22em] text-zinc-500">
          Current password
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-red-400/60"
        />
      </label>

      <label className="block">
        <span className="text-xs uppercase tracking-[0.22em] text-zinc-500">
          Type <span className="font-mono text-red-300">delete my account</span> to confirm
        </span>
        <input
          type="text"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete="off"
          required
          className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 font-mono text-white outline-none focus:border-red-400/60"
        />
      </label>

      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded-2xl bg-red-500 px-5 py-3 font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "loading" ? "Deleting..." : "Permanently delete my account"}
      </button>

      {message ? (
        <p className="text-sm text-red-400" role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}
