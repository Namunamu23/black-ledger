"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type RecordItem = {
  id?: number;
  title: string;
  category: string;
  summary: string;
  body: string;
  unlockStage: number;
  sortOrder: number;
};

type Props = {
  caseId: number;
  data: RecordItem[];
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function RecordsTab({ caseId, data }: Props) {
  const router = useRouter();
  const [records, setRecords] = useState<RecordItem[]>(data);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState("");

  function update<K extends keyof RecordItem>(
    index: number,
    key: K,
    value: RecordItem[K]
  ) {
    setRecords((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
    setStatus("idle");
  }

  function add() {
    setRecords((prev) => [
      ...prev,
      {
        title: "",
        category: "",
        summary: "",
        body: "",
        unlockStage: 1,
        sortOrder: prev.length + 1,
      },
    ]);
    setStatus("idle");
  }

  function remove(index: number) {
    setRecords((prev) => prev.filter((_, i) => i !== index));
    setStatus("idle");
  }

  async function save() {
    setStatus("saving");
    setError("");
    try {
      const response = await fetch(`/api/admin/cases/${caseId}/records`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records }),
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
        <h2 className="text-2xl font-semibold text-white">Records</h2>
        <button
          type="button"
          onClick={add}
          className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Add Record
        </button>
      </div>

      <div className="mt-6 grid gap-4">
        {records.map((record, index) => (
          <div
            key={record.id ?? `new-${index}`}
            className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
          >
            <div className="grid gap-4">
              <input
                value={record.title}
                onChange={(e) => update(index, "title", e.target.value)}
                placeholder="Title"
                className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none"
              />
              <input
                value={record.category}
                onChange={(e) => update(index, "category", e.target.value)}
                placeholder="Category (e.g. Witness Statement, Access Log)"
                className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none"
              />
              <textarea
                value={record.summary}
                onChange={(e) => update(index, "summary", e.target.value)}
                placeholder="Summary"
                className="min-h-[80px] rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none"
              />
              <textarea
                value={record.body}
                onChange={(e) => update(index, "body", e.target.value)}
                placeholder="Body (full record content)"
                className="min-h-[140px] rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none"
              />
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  type="number"
                  value={record.unlockStage}
                  onChange={(e) =>
                    update(index, "unlockStage", Number(e.target.value))
                  }
                  placeholder="Unlock stage"
                  className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none"
                />
                <input
                  type="number"
                  value={record.sortOrder}
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
                Remove Record
              </button>
            </div>
          </div>
        ))}
      </div>

      <SaveBar status={status} error={error} onSave={save} label="Records" />
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
