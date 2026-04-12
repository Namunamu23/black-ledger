"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CheckpointFormProps = {
  slug: string;
  prompt: string;
};

export default function CheckpointForm({
  slug,
  prompt,
}: CheckpointFormProps) {
  const router = useRouter();

  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch(`/api/cases/${slug}/checkpoint`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ answer }),
      });

      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setStatus("error");
        setMessage(data.message ?? "Checkpoint failed.");
        return;
      }

      setStatus("success");
      setMessage(data.message ?? "Checkpoint cleared.");
      setAnswer("");
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm leading-7 text-zinc-300">
        {prompt}
      </div>

      <input
        type="text"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Enter your answer"
        className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
        required
      />

      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-2xl bg-white px-5 py-3 font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === "loading" ? "Checking..." : "Submit Checkpoint"}
      </button>

      {message ? (
        <p
          className={`text-sm ${
            status === "success" ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}