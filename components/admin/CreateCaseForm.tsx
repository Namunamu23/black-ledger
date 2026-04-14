"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateCaseForm() {
  const router = useRouter();

  const [form, setForm] = useState({
    title: "",
    slug: "",
    summary: "",
    players: "1–4",
    duration: "90–150 min",
    difficulty: "Moderate",
    maxStage: "3",
    solutionSuspect: "",
    solutionMotive: "",
    solutionEvidence: "",
    debriefOverview: "",
    debriefWhatHappened: "",
    debriefWhyItWorked: "",
    debriefClosing: "",
    initialActivationCode: "",
  });

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  function updateField(name: string, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/admin/cases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setStatus("error");
        setMessage(data.message ?? "Could not create case.");
        return;
      }

      setStatus("success");
      setMessage(data.message ?? "Case created.");
      router.refresh();

      setForm({
        title: "",
        slug: "",
        summary: "",
        players: "1–4",
        duration: "90–150 min",
        difficulty: "Moderate",
        maxStage: "3",
        solutionSuspect: "",
        solutionMotive: "",
        solutionEvidence: "",
        debriefOverview: "",
        debriefWhatHappened: "",
        debriefWhyItWorked: "",
        debriefClosing: "",
        initialActivationCode: "",
      });
    } catch {
      setStatus("error");
      setMessage("Something went wrong.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <input
        value={form.title}
        onChange={(e) => updateField("title", e.target.value)}
        placeholder="Case title"
        className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
        required
      />

      <input
        value={form.slug}
        onChange={(e) => updateField("slug", e.target.value)}
        placeholder="case-slug"
        className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
        required
      />

      <textarea
        value={form.summary}
        onChange={(e) => updateField("summary", e.target.value)}
        placeholder="Case summary"
        className="min-h-[100px] rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
        required
      />

      <div className="grid gap-4 md:grid-cols-4">
        <input
          value={form.players}
          onChange={(e) => updateField("players", e.target.value)}
          placeholder="Players"
          className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
          required
        />
        <input
          value={form.duration}
          onChange={(e) => updateField("duration", e.target.value)}
          placeholder="Duration"
          className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
          required
        />
        <input
          value={form.difficulty}
          onChange={(e) => updateField("difficulty", e.target.value)}
          placeholder="Difficulty"
          className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
          required
        />
        <input
          value={form.maxStage}
          onChange={(e) => updateField("maxStage", e.target.value)}
          placeholder="Max stages"
          className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
          required
        />
      </div>

      <input
        value={form.solutionSuspect}
        onChange={(e) => updateField("solutionSuspect", e.target.value)}
        placeholder="Solution suspect"
        className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
        required
      />

      <textarea
        value={form.solutionMotive}
        onChange={(e) => updateField("solutionMotive", e.target.value)}
        placeholder="Solution motive"
        className="min-h-[90px] rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
        required
      />

      <textarea
        value={form.solutionEvidence}
        onChange={(e) => updateField("solutionEvidence", e.target.value)}
        placeholder="Solution evidence"
        className="min-h-[90px] rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
        required
      />

      <textarea
        value={form.debriefOverview}
        onChange={(e) => updateField("debriefOverview", e.target.value)}
        placeholder="Debrief overview"
        className="min-h-[90px] rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
        required
      />

      <textarea
        value={form.debriefWhatHappened}
        onChange={(e) => updateField("debriefWhatHappened", e.target.value)}
        placeholder="Debrief: what happened"
        className="min-h-[120px] rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
        required
      />

      <textarea
        value={form.debriefWhyItWorked}
        onChange={(e) => updateField("debriefWhyItWorked", e.target.value)}
        placeholder="Debrief: why it worked"
        className="min-h-[120px] rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
        required
      />

      <textarea
        value={form.debriefClosing}
        onChange={(e) => updateField("debriefClosing", e.target.value)}
        placeholder="Debrief closing"
        className="min-h-[100px] rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
        required
      />

      <input
        value={form.initialActivationCode}
        onChange={(e) => updateField("initialActivationCode", e.target.value.toUpperCase())}
        placeholder="Initial activation code (optional)"
        className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
      />

      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-2xl bg-white px-5 py-3 font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === "loading" ? "Creating..." : "Create Case"}
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