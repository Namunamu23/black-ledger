"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = { caseId: number };

type Status = "idle" | "saving" | "saved" | "error";

export default function GenerateCodesForm({ caseId }: Props) {
  const router = useRouter();
  const [count, setCount] = useState(1);
  const [kitSerialPrefix, setKitSerialPrefix] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [generated, setGenerated] = useState<string[]>([]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");
    setGenerated([]);

    try {
      const response = await fetch(`/api/admin/cases/${caseId}/codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count,
          kitSerialPrefix: kitSerialPrefix.trim() || undefined,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
        codes?: string[];
      };

      if (!response.ok) {
        setStatus("error");
        setMessage(data.message ?? "Could not generate codes.");
        return;
      }

      setStatus("saved");
      setMessage(`Generated ${data.codes?.length ?? 0} codes.`);
      setGenerated(data.codes ?? []);
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Network error.");
    }
  }

  return (
    <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-2xl font-semibold text-white">Generate codes</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Each code is unique and ties to this case file. Optional kit serial
        prefix is stored alongside the code for batch tracking.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 grid gap-4 md:grid-cols-[1fr_2fr_auto]"
      >
        <input
          type="number"
          min={1}
          max={100}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          placeholder="Count (1–100)"
          className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
        />
        <input
          value={kitSerialPrefix}
          onChange={(e) => setKitSerialPrefix(e.target.value)}
          placeholder="Kit serial prefix (optional, e.g. ALDER-)"
          className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
        />
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded-2xl bg-white px-5 py-3 font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "saving" ? "Generating..." : "Generate"}
        </button>
      </form>

      {message ? (
        <p
          className={`mt-4 text-sm ${
            status === "error" ? "text-red-400" : "text-emerald-400"
          }`}
        >
          {message}
        </p>
      ) : null}

      {generated.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
            Newly generated (copy now — they will not be re-displayed)
          </div>
          <pre className="mt-3 overflow-x-auto text-sm font-mono text-emerald-300">
            {generated.join("\n")}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
