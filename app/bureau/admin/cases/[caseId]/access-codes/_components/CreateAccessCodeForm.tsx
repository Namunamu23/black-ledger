"use client";

import { useMemo, useState } from "react";

type TargetType = "record" | "person" | "hint";
type Kind = "BUREAU_REF" | "ARTIFACT_QR" | "WITNESS_TIP" | "AUDIO_FILE";
type Status = "idle" | "saving" | "saved" | "error";

type Props = {
  caseId: number;
  people: { id: number; name: string }[];
  records: { id: number; title: string }[];
  hints: { id: number; title: string }[];
  onCreated: () => void;
};

function randomHex8() {
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export default function CreateAccessCodeForm({
  caseId,
  people,
  records,
  hints,
  onCreated,
}: Props) {
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<Kind>("ARTIFACT_QR");
  const [targetType, setTargetType] = useState<TargetType>("record");
  const [targetId, setTargetId] = useState<number | "">("");
  const [requiresStageRaw, setRequiresStageRaw] = useState("");
  const [oneTimePerUser, setOneTimePerUser] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const targetOptions = useMemo(() => {
    if (targetType === "record") {
      return records.map((r) => ({ id: r.id, label: r.title }));
    }
    if (targetType === "person") {
      return people.map((p) => ({ id: p.id, label: p.name }));
    }
    return hints.map((h) => ({ id: h.id, label: h.title }));
  }, [targetType, records, people, hints]);

  function handleTargetTypeChange(next: TargetType) {
    setTargetType(next);
    setTargetId("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");

    if (targetId === "") {
      setStatus("error");
      setMessage("Pick a target row.");
      return;
    }

    const parsedStage =
      requiresStageRaw.trim() === "" ? null : Number(requiresStageRaw);
    if (parsedStage !== null && !Number.isInteger(parsedStage)) {
      setStatus("error");
      setMessage("Required stage must be an integer or empty.");
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/cases/${caseId}/access-codes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: code.trim(),
            kind,
            unlocksTarget: { type: targetType, id: Number(targetId) },
            requiresStage: parsedStage,
            oneTimePerUser,
          }),
        }
      );

      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
      };

      if (!response.ok) {
        setStatus("error");
        setMessage(data.message ?? "Could not create access code.");
        return;
      }

      setStatus("saved");
      setMessage(`Created ${code.trim()}.`);
      setCode("");
      setTargetId("");
      setRequiresStageRaw("");
      onCreated();
    } catch {
      setStatus("error");
      setMessage("Network error.");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6"
    >
      <h2 className="text-2xl font-semibold text-white">Create access code</h2>
      <p className="mt-2 text-sm text-zinc-400">
        The short code becomes the last segment of a scannable URL
        (<span className="font-mono">/u/&lt;code&gt;</span>) that redirects to
        the unlock page.
      </p>

      <div className="mt-6 grid gap-4">
        <div className="grid gap-3 md:grid-cols-[2fr_auto]">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Code (e.g. ALDER-A1B2C3D4)"
            required
            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 font-mono text-white outline-none"
          />
          <button
            type="button"
            onClick={() => setCode(randomHex8())}
            className="rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-950"
          >
            Generate
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.25em] text-zinc-500">
              Kind
            </span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
            >
              <option value="BUREAU_REF">Bureau Reference</option>
              <option value="ARTIFACT_QR">Artifact QR</option>
              <option value="WITNESS_TIP">Witness Tip</option>
              <option value="AUDIO_FILE">Audio File</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.25em] text-zinc-500">
              Target type
            </span>
            <select
              value={targetType}
              onChange={(e) =>
                handleTargetTypeChange(e.target.value as TargetType)
              }
              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
            >
              <option value="record">Record</option>
              <option value="person">Person</option>
              <option value="hint">Hint</option>
            </select>
          </label>
        </div>

        <label className="grid gap-2">
          <span className="text-xs uppercase tracking-[0.25em] text-zinc-500">
            Target
          </span>
          <select
            value={targetId === "" ? "" : String(targetId)}
            onChange={(e) =>
              setTargetId(e.target.value === "" ? "" : Number(e.target.value))
            }
            required
            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
          >
            <option value="">
              {targetOptions.length === 0
                ? `No ${targetType}s available — add one first.`
                : "Select target..."}
            </option>
            {targetOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                #{opt.id} — {opt.label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.25em] text-zinc-500">
              Requires stage (blank = no gate)
            </span>
            <input
              type="number"
              min={0}
              value={requiresStageRaw}
              onChange={(e) => setRequiresStageRaw(e.target.value)}
              placeholder="Leave blank to unlock at any stage"
              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
            />
          </label>

          <label className="flex items-end gap-3 pb-3 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={oneTimePerUser}
              onChange={(e) => setOneTimePerUser(e.target.checked)}
            />
            One-time per user
          </label>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="submit"
          disabled={status === "saving" || code.trim() === "" || targetId === ""}
          className="rounded-2xl bg-white px-5 py-3 font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "saving" ? "Creating..." : "Create code"}
        </button>

        {status === "saved" ? (
          <span className="text-sm text-emerald-400">{message}</span>
        ) : null}
        {status === "error" ? (
          <span className="text-sm text-red-400">{message}</span>
        ) : null}
      </div>
    </form>
  );
}
