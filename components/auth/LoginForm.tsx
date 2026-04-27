"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { pickPostLoginPath } from "@/lib/post-login-path";

export default function LoginForm() {
  const searchParams = useSearchParams();
  // Sanitized at render time so the closure inside handleSubmit captures
  // the safe path. Anything off-origin or non-relative falls back to
  // /bureau via pickPostLoginPath.
  const postLoginPath = pickPostLoginPath(searchParams.get("callbackUrl"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setStatus("loading");
    setMessage("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (!result || result.error) {
      setStatus("error");
      setMessage("Invalid email or password.");
      return;
    }

    window.location.assign(postLoginPath);
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

      <input
        type="password"
        placeholder="Password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
        required
      />

      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-2xl bg-amber-400 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === "loading" ? "Logging in..." : "Log In"}
      </button>

      {message ? <p className="text-sm text-red-400">{message}</p> : null}

      <div className="flex items-center justify-between text-sm">
        <Link
          href="/forgot-password"
          className="text-zinc-500 hover:text-zinc-300"
        >
          Forgot password?
        </Link>
        <Link href="/register" className="text-amber-400 hover:text-amber-300">
          Create account
        </Link>
      </div>
    </form>
  );
}