"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type PersonItem = {
  id?: number;
  globalPersonId: number | null;
  name: string;
  role: string;
  summary: string;
  unlockStage: number;
  sortOrder: number;
};

type Props = {
  caseId: number;
  data: PersonItem[];
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function PeopleTab({ caseId, data }: Props) {
  const router = useRouter();
  const [people, setPeople] = useState<PersonItem[]>(data);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState("");

  function update<K extends keyof PersonItem>(
    index: number,
    key: K,
    value: PersonItem[K]
  ) {
    setPeople((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
    setStatus("idle");
  }

  function add() {
    setPeople((prev) => [
      ...prev,
      {
        globalPersonId: null,
        name: "",
        role: "",
        summary: "",
        unlockStage: 1,
        sortOrder: prev.length + 1,
      },
    ]);
    setStatus("idle");
  }

  function remove(index: number) {
    setPeople((prev) => prev.filter((_, i) => i !== index));
    setStatus("idle");
  }

  async function save() {
    setStatus("saving");
    setError("");
    try {
      const response = await fetch(`/api/admin/cases/${caseId}/people`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ people }),
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
        <h2 className="text-2xl font-semibold text-white">People</h2>
        <button
          type="button"
          onClick={add}
          className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Add Person
        </button>
      </div>

      <div className="mt-6 grid gap-4">
        {people.map((person, index) => (
          <div
            key={person.id ?? `new-${index}`}
            className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
          >
            <div className="grid gap-4">
              <input
                value={person.name}
                onChange={(e) => update(index, "name", e.target.value)}
                placeholder="Name"
                className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none"
              />
              <input
                value={person.role}
                onChange={(e) => update(index, "role", e.target.value)}
                placeholder="Role"
                className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none"
              />
              <textarea
                value={person.summary}
                onChange={(e) => update(index, "summary", e.target.value)}
                placeholder="Summary"
                className="min-h-[90px] rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none"
              />
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  type="number"
                  value={person.unlockStage}
                  onChange={(e) =>
                    update(index, "unlockStage", Number(e.target.value))
                  }
                  placeholder="Unlock stage"
                  className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none"
                />
                <input
                  type="number"
                  value={person.sortOrder}
                  onChange={(e) =>
                    update(index, "sortOrder", Number(e.target.value))
                  }
                  placeholder="Sort order"
                  className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none"
                />
              </div>
              {person.globalPersonId !== null ? (
                <p className="text-xs text-zinc-500">
                  Linked to GlobalPerson #{person.globalPersonId} (preserved
                  on save)
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => remove(index)}
                className="rounded-2xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-400"
              >
                Remove Person
              </button>
            </div>
          </div>
        ))}
      </div>

      <SaveBar status={status} error={error} onSave={save} label="People" />
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
