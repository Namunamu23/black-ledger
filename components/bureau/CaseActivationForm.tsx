"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";

export default function CaseActivationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Pre-fill from ?activate=CODE deep-link so users who arrive from the
  // purchase email (which includes the code in the URL) don't have to
  // manually copy-paste the code.
  const [code, setCode] = useState(
    () => searchParams.get("activate")?.trim().toUpperCase() ?? ""
  );

  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/cases/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });

      const data = (await response.json()) as {
        message?: string;
        slug?: string;
      };

      if (!response.ok) {
        setStatus("error");
        setMessage(data.message ?? "Activation failed.");
        return;
      }

      setStatus("success");
      setMessage(data.message ?? "Case activated.");
      setCode("");
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter activation code"
          className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
          required
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-2xl bg-amber-400 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "loading" ? "Activating..." : "Activate"}
        </button>
      </div>

      {message ? (
        <p
          className={`mt-3 text-sm ${
            status === "success" ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
