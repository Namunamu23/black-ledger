"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type SolutionTabData = {
  solutionSuspect: string;
  solutionMotive: string;
  solutionEvidence: string;
  debriefOverview: string;
  debriefWhatHappened: string;
  debriefWhyItWorked: string;
  debriefClosing: string;
  debriefSectionTitle: string | null;
  debriefIntro: string | null;
};

type Props = {
  caseId: number;
  data: SolutionTabData;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function SolutionTab({ caseId, data }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<SolutionTabData>(data);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState("");

  function update<K extends keyof SolutionTabData>(
    key: K,
    value: SolutionTabData[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setStatus("idle");
  }

  async function save() {
    setStatus("saving");
    setError("");
    try {
      const response = await fetch(`/api/admin/cases/${caseId}/solution`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        setError(json.message ?? "Save failed.");
        setStatus("error");
        return;
      }
      setStatus("saved");
      router.refresh();
    } catch {
      setError("Network error.");
      setStatus("error");
    }
  }

  return (
    <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-2xl font-semibold text-white">Solution + Debrief</h2>

      <div className="mt-6 grid gap-4">
        <input
          value={form.solutionSuspect}
          onChange={(e) => update("solutionSuspect", e.target.value)}
          placeholder="Solution suspect (pipe-separated aliases, e.g. Anya Volkov|Mr. Volkov)"
          className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
        />
        <textarea
          value={form.solutionMotive}
          onChange={(e) => update("solutionMotive", e.target.value)}
          placeholder="Solution motive (pipe-separated phrasings)"
          className="min-h-[90px] rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
        />
        <textarea
          value={form.solutionEvidence}
          onChange={(e) => update("solutionEvidence", e.target.value)}
          placeholder="Solution evidence (pipe-separated phrasings)"
          className="min-h-[90px] rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
        />

        <textarea
          value={form.debriefOverview}
          onChange={(e) => update("debriefOverview", e.target.value)}
          placeholder="Debrief overview"
          className="min-h-[90px] rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
        />
        <textarea
          value={form.debriefWhatHappened}
          onChange={(e) => update("debriefWhatHappened", e.target.value)}
          placeholder="Debrief: what happened"
          className="min-h-[140px] rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
        />
        <textarea
          value={form.debriefWhyItWorked}
          onChange={(e) => update("debriefWhyItWorked", e.target.value)}
          placeholder="Debrief: why the original theory failed"
          className="min-h-[140px] rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
        />
        <input
          value={form.debriefSectionTitle ?? ""}
          onChange={(e) =>
            update("debriefSectionTitle", e.target.value || null)
          }
          placeholder='Debrief section title (defaults to "Why your theory was incomplete" if blank)'
          className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
        />
        <textarea
          value={form.debriefIntro ?? ""}
          onChange={(e) => update("debriefIntro", e.target.value || null)}
          placeholder="Debrief intro paragraph (optional)"
          className="min-h-[90px] rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
        />
        <textarea
          value={form.debriefClosing}
          onChange={(e) => update("debriefClosing", e.target.value)}
          placeholder="Debrief closing"
          className="min-h-[100px] rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
        />
      </div>

      <SaveBar status={status} error={error} onSave={save} label="Solution" />
    </div>
  );
}

function SaveBar({
  status,
  error,
  onSave,
  label,
}: {
  status: SaveStatus;
  error: string;
  onSave: () => void;
  label: string;
}) {
  return (
    <div className="mt-6 flex items-center gap-4">
      <button
        type="button"
        onClick={onSave}
        disabled={status === "saving"}
        className="rounded-2xl bg-white px-5 py-3 font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === "saving" ? "Saving..." : `Save ${label}`}
      </button>
      {status === "saved" ? (
        <span className="text-sm text-emerald-400">Saved ✓</span>
      ) : null}
      {status === "error" ? (
        <span className="text-sm text-red-400">
          {error || "Error — try again."}
        </span>
      ) : null}
    </div>
  );
}
