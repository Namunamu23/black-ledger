"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type PublishCaseButtonProps = {
  caseId: number;
  workflowStatus: string;
};

export default function PublishCaseButton({
  caseId,
  workflowStatus,
}: PublishCaseButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleClick() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/cases/${caseId}/publish`, {
        method: "PATCH",
      });

      const data = (await response.json()) as {
        message?: string;
        issues?: string[];
      };

      if (!response.ok) {
        const issueText = data.issues?.length
          ? ` ${data.issues.join(" ")}`
          : "";
        setMessage((data.message ?? "Could not update publish state.") + issueText);
        setLoading(false);
        return;
      }

      setMessage(data.message ?? "Publish state updated.");
      router.refresh();
    } catch {
      setMessage("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const isPublished = workflowStatus === "PUBLISHED";

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={`rounded-2xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
          isPublished
            ? "border border-zinc-700 text-white hover:bg-zinc-950"
            : "bg-white text-zinc-950 hover:bg-zinc-200"
        }`}
      >
        {loading ? "Updating..." : isPublished ? "Unpublish" : "Publish"}
      </button>

      {message ? <p className="mt-2 text-xs text-zinc-400">{message}</p> : null}
    </div>
  );
}