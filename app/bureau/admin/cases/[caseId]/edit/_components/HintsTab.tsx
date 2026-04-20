"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type HintItem = {
  id?: number;
  level: number;
  title: string;
  content: string;
  unlockStage: number;
  sortOrder: number;
};

type Props = {
  caseId: number;
  data: HintItem[];
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function HintsTab({ caseId, data }: Props) {
  const router = useRouter();
  const [hints, setHints] = useState<HintItem[]>(data);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState("");

  function update<K extends keyof HintItem>(
    index: number,
    key: K,
    value: HintItem[K]
  ) {
    setHints((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
    setStatus("idle");
  }

  function add() {
    setHints((prev) => [
      ...prev,
      {
        level: prev.length + 1,
        title: "",
        content: "",
        unlockStage: 1,
        sortOrder: prev.length + 1,
      },
    ]);
    setStatus("idle");
  }

  function remove(index: number) {
    setHints((prev) => prev.filter((_, i) => i !== index));
    setStatus("idle");
  }

  async function save() {
    setStatus("saving");
    setError("");
    try {
      const response = await fetch(`/api/admin/cases/${caseId}/hints`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hints }),
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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-white">Hints</h2>
        <button
          type="button"
          onClick={add}
          className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Add Hint
        </button>
      </div>

      <div className="mt-6 grid gap-4">
        {hints.map((hint, index) => (
          <div
            key={hint.id ?? `new-${index}`}
            className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
          >
            <div className="grid gap-4">
              <input
                type="number"
                value={hint.level}
                onChange={(e) => update(index, "level", Number(e.target.value))}
                placeholder="Level (1 = first hint shown)"
                className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none"
              />
              <input
                value={hint.title}
                onChange={(e) => update(index, "title", e.target.value)}
                placeholder="Title"
                className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none"
              />
              <textarea
                value={hint.content}
                onChange={(e) => update(index, "content", e.target.value)}
                placeholder="Hint content"
                className="min-h-[120px] rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none"
              />
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  type="number"
                  value={hint.unlockStage}
                  onChange={(e) =>
                    update(index, "unlockStage", Number(e.target.value))
                  }
                  placeholder="Unlock stage"
                  className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none"
                />
                <input
                  type="number"
                  value={hint.sortOrder}
                  onChange={(e) =>
                    update(index, "sortOrder", Number(e.target.value))
                  }
                  placeholder="Sort order"
                  className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => remove(index)}
                className="rounded-2xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-400"
              >
                Remove Hint
              </button>
            </div>
          </div>
        ))}
      </div>

      <SaveBar status={status} error={error} onSave={save} label="Hints" />
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
