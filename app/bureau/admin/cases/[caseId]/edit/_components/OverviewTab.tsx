"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImageUploader from "@/components/admin/ImageUploader";

export type OverviewTabData = {
  title: string;
  slug: string;
  summary: string;
  players: string;
  duration: string;
  difficulty: string;
  maxStage: number;
  isActive: boolean;
  heroImageUrl: string | null;
};

type Props = {
  caseId: number;
  data: OverviewTabData;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function OverviewTab({ caseId, data }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<OverviewTabData>(data);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState("");

  function update<K extends keyof OverviewTabData>(
    key: K,
    value: OverviewTabData[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setStatus("idle");
  }

  async function save() {
    setStatus("saving");
    setError("");
    try {
      const response = await fetch(`/api/admin/cases/${caseId}/overview`, {
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
      <h2 className="text-2xl font-semibold text-white">Overview</h2>

      <div className="mt-6 grid gap-4">
        <input
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="Case title"
          className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
        />
        <input
          value={form.slug}
          onChange={(e) => update("slug", e.target.value)}
          placeholder="case-slug"
          className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
        />
        <textarea
          value={form.summary}
          onChange={(e) => update("summary", e.target.value)}
          placeholder="Summary (logline)"
          className="min-h-[100px] rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
        />

        <div className="grid gap-4 md:grid-cols-4">
          <input
            value={form.players}
            onChange={(e) => update("players", e.target.value)}
            placeholder="Players"
            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
          />
          <input
            value={form.duration}
            onChange={(e) => update("duration", e.target.value)}
            placeholder="Duration"
            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
          />
          <input
            value={form.difficulty}
            onChange={(e) => update("difficulty", e.target.value)}
            placeholder="Difficulty"
            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
          />
          <input
            type="number"
            value={form.maxStage}
            onChange={(e) => update("maxStage", Number(e.target.value))}
            placeholder="Max stages"
            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
          />
        </div>

        <label className="flex items-center gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => update("isActive", e.target.checked)}
          />
          Case is active
        </label>

        <ImageUploader
          context="hero"
          label="Hero Image"
          value={form.heroImageUrl ?? ""}
          onChange={(url) => update("heroImageUrl", url || null)}
        />
      </div>

      <SaveBar status={status} error={error} onSave={save} label="Overview" />
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
