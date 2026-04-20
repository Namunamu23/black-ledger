"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  caseId: number;
  codeId: number;
  code: string;
};

export default function RevokeButton({ caseId, codeId, code }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    if (!confirm(`Revoke ${code}? This cannot be undone via the UI.`)) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/cases/${caseId}/codes/${codeId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revokedAt: new Date().toISOString() }),
        }
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        setError(data.message ?? "Could not revoke.");
        setLoading(false);
        return;
      }

      router.refresh();
    } catch {
      setError("Network error.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-2xl border border-red-500/30 px-3 py-1 text-xs font-semibold text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "Revoking..." : "Revoke"}
      </button>
      {error ? <span className="text-xs text-red-400">{error}</span> : null}
    </div>
  );
}
