"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CaseWorkflowStatus } from "@/lib/enums";

type PublishCaseButtonProps = {
  caseId: number;
  workflowStatus: CaseWorkflowStatus;
};

/**
 * For each current workflow state, the action this button advances the case
 * into. Null means there is no next forward action — the case is terminal
 * (ARCHIVED).
 */
const NEXT_ACTION: Record<
  CaseWorkflowStatus,
  { target: CaseWorkflowStatus; label: string } | null
> = {
  [CaseWorkflowStatus.DRAFT]: {
    target: CaseWorkflowStatus.IN_REVIEW,
    label: "Send to Review",
  },
  [CaseWorkflowStatus.IN_REVIEW]: {
    target: CaseWorkflowStatus.PUBLISHED,
    label: "Publish",
  },
  [CaseWorkflowStatus.PUBLISHED]: {
    target: CaseWorkflowStatus.ARCHIVED,
    label: "Archive",
  },
  [CaseWorkflowStatus.ARCHIVED]: null,
};

export default function PublishCaseButton({
  caseId,
  workflowStatus,
}: PublishCaseButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const action = NEXT_ACTION[workflowStatus];

  async function handleClick() {
    if (!action) return;
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/cases/${caseId}/workflow`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowStatus: action.target }),
      });

      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setMessage(data.message ?? "Could not update workflow state.");
        setLoading(false);
        return;
      }

      setMessage(`Moved to ${action.target}.`);
      router.refresh();
    } catch {
      setMessage("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (!action) {
    return (
      <div>
        <button
          type="button"
          disabled
          className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-500"
        >
          Archived
        </button>
      </div>
    );
  }

  const isPublishStep = action.target === CaseWorkflowStatus.PUBLISHED;
  const isArchiveStep = action.target === CaseWorkflowStatus.ARCHIVED;

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={`rounded-2xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
          isArchiveStep
            ? "border border-red-500/40 text-red-300 hover:bg-red-500/10"
            : isPublishStep
              ? "bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
              : "bg-white text-zinc-950 hover:bg-zinc-200"
        }`}
      >
        {loading ? "Updating..." : action.label}
      </button>

      {message ? <p className="mt-2 text-xs text-zinc-400">{message}</p> : null}
    </div>
  );
}
