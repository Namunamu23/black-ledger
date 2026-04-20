"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type CheckpointItem = {
  id?: number;
  stage: number;
  prompt: string;
  acceptedAnswers: string;
  successMessage: string;
};

type Props = {
  caseId: number;
  data: CheckpointItem[];
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function CheckpointsTab({ caseId, data }: Props) {
  const router = useRouter();
  const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>(data);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState("");

  function update<K extends keyof CheckpointItem>(
    index: number,
    key: K,
    value: CheckpointItem[K]
  ) {
    setCheckpoints((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
    setStatus("idle");
  }

  function add() {
    setCheckpoints((prev) => [
      ...prev,
      {
        stage: prev.length + 1,
        prompt: "",
        acceptedAnswers: "",
        successMessage: "",
      },
    ]);
    setStatus("idle");
  }

  function remove(index: number) {
    setCheckpoints((prev) => prev.filter((_, i) => i !== index));
    setStatus("idle");
  }

  async function save() {
    setStatus("saving");
    setError("");
    try {
      const response = await fetch(`/api/admin/cases/${caseId}/checkpoints`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkpoints }),
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
        <h2 className="text-2xl font-semibold text-white">Checkpoints</h2>
        <button
          type="button"
          onClick={add}
          className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Add Checkpoint
        </button>
      </div>

      <div className="mt-6 grid gap-4">
        {checkpoints.map((checkpoint, index) => (
          <div
            key={checkpoint.id ?? `new-${index}`}
            className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
          >
            <div className="grid gap-4">
              <input
                type="number"
                value={checkpoint.stage}
                onChange={(e) =>
                  update(index, "stage", Number(e.target.value))
                }
                placeholder="Stage (must be unique within case)"
                className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none"
              />
              <textarea
                value={checkpoint.prompt}
                onChange={(e) => update(index, "prompt", e.target.value)}
                placeholder="Prompt shown to the player"
                className="min-h-[90px] rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none"
              />
              <input
                value={checkpoint.acceptedAnswers}
                onChange={(e) =>
                  update(index, "acceptedAnswers", e.target.value)
                }
                placeholder="Accepted answers — pipe-separated, e.g. badge access log|access log|badge log"
                className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none"
              />
              <textarea
                value={checkpoint.successMessage}
                onChange={(e) =>
                  update(index, "successMessage", e.target.value)
                }
                placeholder="Success message shown after a correct answer"
                className="min-h-[80px] rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none"
              />
              <button
                type="button"
                onClick={() => remove(index)}
                className="rounded-2xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-400"
              >
                Remove Checkpoint
              </button>
            </div>
          </div>
        ))}
      </div>

      <SaveBar
        status={status}
        error={error}
        onSave={save}
        label="Checkpoints"
      />
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
