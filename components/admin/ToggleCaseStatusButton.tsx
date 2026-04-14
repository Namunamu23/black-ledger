"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ToggleCaseStatusButtonProps = {
  caseId: number;
  isActive: boolean;
};

export default function ToggleCaseStatusButton({
  caseId,
  isActive,
}: ToggleCaseStatusButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);

    try {
      await fetch(`/api/admin/cases/${caseId}/status`, {
        method: "PATCH",
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-950 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading ? "Updating..." : isActive ? "Deactivate" : "Activate"}
    </button>
  );
}