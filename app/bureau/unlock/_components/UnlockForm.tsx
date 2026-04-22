"use client";

import { useEffect, useRef, useState } from "react";

type RecordContent = {
  type: "record";
  record: { id: number; title: string; body: string } | null;
};
type PersonContent = {
  type: "person";
  person: { id: number; name: string; summary: string } | null;
};
type HintContent = {
  type: "hint";
  hint: { id: number; title: string; content: string } | null;
};
type FallbackContent = { type: string; raw: unknown };
type Content = RecordContent | PersonContent | HintContent | FallbackContent;

type SuccessPayload = {
  alreadyRedeemed: boolean;
  unlocksTarget: unknown;
  content: Content;
};

type Status = "idle" | "submitting" | "success" | "error";

type Props = { initialCode?: string };

export default function UnlockForm({ initialCode }: Props) {
  const [code, setCode] = useState(initialCode ?? "");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<SuccessPayload | null>(null);
  const autoSubmitted = useRef(false);

  async function submit(submitCode: string) {
    setStatus("submitting");
    setError("");
    setPayload(null);

    try {
      const response = await fetch("/api/access-codes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: submitCode }),
      });

      const data = (await response.json().catch(() => ({}))) as
        | SuccessPayload
        | { message?: string };

      if (!response.ok) {
        const message =
          (data as { message?: string }).message ?? "Could not redeem code.";
        setError(message);
        setStatus("error");
        return;
      }

      setPayload(data as SuccessPayload);
      setStatus("success");
    } catch {
      setError("Network error.");
      setStatus("error");
    }
  }

  useEffect(() => {
    if (initialCode && !autoSubmitted.current) {
      autoSubmitted.current = true;
      void submit(initialCode);
    }
  }, [initialCode]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.trim().length === 0) return;
    void submit(code.trim());
  }

  return (
    <div className="grid gap-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6"
      >
        <label className="text-xs uppercase tracking-[0.3em] text-zinc-500">
          Access Code
        </label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter or scan code"
            autoFocus
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 font-mono text-white outline-none placeholder:text-zinc-500"
          />
          <button
            type="submit"
            disabled={status === "submitting" || code.trim().length === 0}
            className="rounded-2xl bg-amber-400 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {status === "submitting" ? "Unlocking..." : "Unlock"}
          </button>
        </div>

        {status === "error" ? (
          <p className="mt-4 text-sm text-red-400">{error}</p>
        ) : null}
      </form>

      {status === "success" && payload ? (
        <UnlockedPanel payload={payload} />
      ) : null}
    </div>
  );
}

function UnlockedPanel({ payload }: { payload: SuccessPayload }) {
  return (
    <div className="rounded-[2rem] border border-emerald-500/30 bg-zinc-900 p-8">
      {payload.alreadyRedeemed ? (
        <p className="mb-6 text-xs uppercase tracking-[0.25em] text-amber-300">
          You&apos;ve already unlocked this evidence.
        </p>
      ) : (
        <p className="mb-6 text-xs uppercase tracking-[0.25em] text-emerald-400">
          Evidence unlocked
        </p>
      )}
      <UnlockedContent content={payload.content} />
    </div>
  );
}

function UnlockedContent({ content }: { content: Content }) {
  // FallbackContent carries `raw` and an unknown discriminator, while the
  // three known shapes use a literal `type` and their own payload key.
  // Narrow on `"raw" in content` first so the literal-typed branches below
  // are not muddied by the supertype `string` from FallbackContent.
  if ("raw" in content) {
    return (
      <pre className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-300">
        {JSON.stringify(content.raw, null, 2)}
      </pre>
    );
  }

  if (content.type === "record") {
    if (!content.record) {
      return (
        <p className="text-sm text-zinc-400">
          The unlocked record is no longer available.
        </p>
      );
    }
    return (
      <article className="prose prose-invert max-w-none">
        <h2 className="text-2xl font-semibold text-white">
          {content.record.title}
        </h2>
        <p className="mt-4 whitespace-pre-line text-base leading-7 text-zinc-200">
          {content.record.body}
        </p>
      </article>
    );
  }

  if (content.type === "person") {
    if (!content.person) {
      return (
        <p className="text-sm text-zinc-400">
          The unlocked subject is no longer available.
        </p>
      );
    }
    return (
      <article>
        <h2 className="text-2xl font-semibold text-white">
          {content.person.name}
        </h2>
        <p className="mt-4 whitespace-pre-line text-base leading-7 text-zinc-200">
          {content.person.summary}
        </p>
      </article>
    );
  }

  if (!content.hint) {
    return (
      <p className="text-sm text-zinc-400">
        The unlocked hint is no longer available.
      </p>
    );
  }
  return (
    <article>
      <h2 className="text-2xl font-semibold text-white">
        {content.hint.title}
      </h2>
      <p className="mt-4 whitespace-pre-line text-base leading-7 text-zinc-200">
        {content.hint.content}
      </p>
    </article>
  );
}
