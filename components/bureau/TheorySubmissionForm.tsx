"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TheorySubmissionFormProps = {
  slug: string;
};

type PublicVerdict = "CASE_CLOSED" | "REVISION_REQUIRED";

export default function TheorySubmissionForm({
  slug,
}: TheorySubmissionFormProps) {
  const [form, setForm] = useState({
    suspectName: "",
    motive: "",
    evidenceSummary: "",
  });

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [verdict, setVerdict] = useState<"" | PublicVerdict>("");
  const [feedback, setFeedback] = useState("");
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setStatus("loading");
    setMessage("");
    setFeedback("");
    setVerdict("");

    try {
      const response = await fetch(`/api/cases/${slug}/theory`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = (await response.json()) as {
        message?: string;
        publicVerdict?: PublicVerdict;
        feedback?: string;
      };

      if (!response.ok) {
        setStatus("error");
        setMessage(data.message ?? "Submission failed.");
        return;
      }

      setStatus("success");
      setMessage(data.message ?? "Theory submitted.");
      setFeedback(data.feedback ?? "");
      setVerdict(data.publicVerdict ?? "");
      setForm({
        suspectName: "",
        motive: "",
        evidenceSummary: "",
      });
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  const resultColor =
    verdict === "CASE_CLOSED"
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
      : "text-amber-300 border-amber-500/30 bg-amber-500/10";

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <input
        type="text"
        placeholder="Primary suspect"
        value={form.suspectName}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, suspectName: e.target.value }))
        }
        className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
        required
      />

      <textarea
        placeholder="What do you believe the motive was?"
        value={form.motive}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, motive: e.target.value }))
        }
        className="min-h-[120px] rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
        required
      />

      <textarea
        placeholder="Summarize the strongest evidence supporting your theory."
        value={form.evidenceSummary}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, evidenceSummary: e.target.value }))
        }
        className="min-h-[140px] rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
        required
      />

      <p className="text-xs leading-5 text-zinc-500">
        Submit only when your suspect, motive, and evidence form one complete chain. This review does not confirm individual pieces of a theory — only whether the whole case meets the Bureau&apos;s closure standard.
      </p>

      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-2xl bg-amber-400 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === "loading" ? "Submitting..." : "Submit Theory"}
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

      {feedback ? (
        <div className={`rounded-2xl border p-4 text-sm leading-7 ${resultColor}`}>
          <div className="text-xs uppercase tracking-[0.2em]">
            {verdict === "CASE_CLOSED"
              ? "Closure Standard Met"
              : verdict === "REVISION_REQUIRED"
              ? "Revision Required"
              : ""}
          </div>
          <div className="mt-2">{feedback}</div>
        </div>
      ) : null}
    </form>
  );
}
