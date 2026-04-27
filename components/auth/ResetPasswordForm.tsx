"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "error" | "success"
  >("idle");
  const [message, setMessage] = useState("");

  // If there is no token in the URL, show an error immediately.
  if (!token) {
    return (
      <div className="mt-8 grid gap-4">
        <p className="text-sm text-red-400">
          This reset link is invalid or has expired. Please request a new one.
        </p>
        <Link
          href="/forgot-password"
          className="text-sm text-amber-400 hover:text-amber-300"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="mt-8 grid gap-4">
        <p className="text-sm leading-6 text-emerald-400">{message}</p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-2xl bg-amber-400 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-amber-300"
        >
          Sign in
        </Link>
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("Passwords do not match.");
      return;
    }

    setStatus("loading");

    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = (await res.json()) as { message?: string };

      if (!res.ok) {
        setStatus("error");
        setMessage(data.message ?? "Reset failed. Please try again.");
        return;
      }

      setStatus("success");
      setMessage(data.message ?? "Password updated. You can now sign in.");
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 grid gap-4">
      <input
        type="password"
        placeholder="New password (min 8 characters)"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
        required
        minLength={8}
      />

      <input
        type="password"
        placeholder="Confirm new password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
        required
      />

      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-2xl bg-amber-400 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === "loading" ? "Updating..." : "Set New Password"}
      </button>

      {message && status === "error" ? (
        <p className="text-sm text-red-400">{message}</p>
      ) : null}
    </form>
  );
}
