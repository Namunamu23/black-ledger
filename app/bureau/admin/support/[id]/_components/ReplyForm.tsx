"use client";

import { useState } from "react";

type Props = {
  messageId: number;
  recipient: string;
};

type Status = "idle" | "sending" | "sent" | "stub" | "error";

export default function ReplyForm({ messageId, recipient }: Props) {
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError("");

    try {
      const response = await fetch(`/api/admin/support/${messageId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        sent?: boolean;
        reason?: string;
        message?: string;
      };

      if (!response.ok) {
        setError(data.message ?? "Could not send reply.");
        setStatus("error");
        return;
      }

      if (data.sent === false) {
        setStatus("stub");
        setError(data.reason ?? "Reply not sent.");
        return;
      }

      setStatus("sent");
      setBody("");
    } catch {
      setError("Network error.");
      setStatus("error");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6"
    >
      <h2 className="text-2xl font-semibold text-white">Reply</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Will be sent to {recipient}.
      </p>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Your reply..."
        required
        className="mt-4 min-h-[160px] w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
      />

      <div className="mt-4 flex items-center gap-4">
        <button
          type="submit"
          disabled={status === "sending" || body.trim().length === 0}
          className="rounded-2xl bg-white px-5 py-3 font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "sending" ? "Sending..." : "Send reply"}
        </button>

        {status === "sent" ? (
          <span className="text-sm text-emerald-400">Sent ✓</span>
        ) : null}
        {status === "stub" ? (
          <span className="text-sm text-amber-300">
            {error || "Reply not sent (transport not configured)."}
          </span>
        ) : null}
        {status === "error" ? (
          <span className="text-sm text-red-400">
            {error || "Error — try again."}
          </span>
        ) : null}
      </div>
    </form>
  );
}
