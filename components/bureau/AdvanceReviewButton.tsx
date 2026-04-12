"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type AdvanceReviewButtonProps = {
  slug: string;
  currentStage: number;
  maxStage: number;
};

export default function AdvanceReviewButton({
  slug,
  currentStage,
  maxStage,
}: AdvanceReviewButtonProps) {
  const router = useRouter();

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleAdvance() {
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch(`/api/cases/${slug}/advance`, {
        method: "POST",
      });

      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setStatus("error");
        setMessage(data.message ?? "Could not unlock the next stage.");
        return;
      }

      setStatus("success");
      setMessage(data.message ?? "Stage advanced.");
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  const complete = currentStage >= maxStage;

  return (
    <div>
      <button
        type="button"
        onClick={handleAdvance}
        disabled={status === "loading" || complete}
        className="rounded-2xl bg-white px-5 py-3 font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {complete
          ? "All stages unlocked"
          : status === "loading"
          ? "Unlocking..."
          : `Unlock Stage ${currentStage + 1}`}
      </button>

      {message ? (
        <p
          className={`mt-3 text-sm ${
            status === "success" ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}