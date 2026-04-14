"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type GenerateActivationCodeButtonProps = {
  caseId: number;
};

export default function GenerateActivationCodeButton({
  caseId,
}: GenerateActivationCodeButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleClick() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/cases/${caseId}/activation-codes`, {
        method: "POST",
      });

      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setMessage(data.message ?? "Could not generate code.");
        setLoading(false);
        return;
      }

      setMessage(data.message ?? "Code created.");
      router.refresh();
    } catch {
      setMessage("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-950 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "Generating..." : "Generate Code"}
      </button>

      {message ? (
        <p className="mt-2 text-xs text-zinc-400">{message}</p>
      ) : null}
    </div>
  );
}