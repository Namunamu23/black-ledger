"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type StatusValue = "NEW" | "HANDLED" | "SPAM";

type Props = {
  messageId: number;
  currentStatus: StatusValue;
};

type Action = { target: StatusValue; label: string; tone: string };

const ALL_ACTIONS: Action[] = [
  {
    target: "HANDLED",
    label: "Mark as handled",
    tone: "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10",
  },
  {
    target: "SPAM",
    label: "Mark as spam",
    tone: "border-red-500/30 text-red-300 hover:bg-red-500/10",
  },
  {
    target: "NEW",
    label: "Reopen",
    tone: "border-zinc-700 text-zinc-200 hover:bg-zinc-950",
  },
];

export default function StatusActions({ messageId, currentStatus }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<StatusValue | null>(null);
  const [error, setError] = useState("");

  const visibleActions = ALL_ACTIONS.filter((a) => a.target !== currentStatus);

  async function applyStatus(target: StatusValue) {
    setBusy(target);
    setError("");
    try {
      const response = await fetch(`/api/admin/support/${messageId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: target }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        setError(data.message ?? "Could not update status.");
        setBusy(null);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {visibleActions.map((action) => (
        <button
          key={action.target}
          type="button"
          onClick={() => applyStatus(action.target)}
          disabled={busy !== null}
          className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${action.tone}`}
        >
          {busy === action.target ? "Updating..." : action.label}
        </button>
      ))}
      {error ? (
        <span className="text-sm text-red-400">{error}</span>
      ) : null}
    </div>
  );
}
