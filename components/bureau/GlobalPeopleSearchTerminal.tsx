"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  searchBureauPeople,
  type PersonSearchResult,
} from "@/app/bureau/database/actions";

type Status = "idle" | "searching" | "results" | "no-results" | "error";

export default function GlobalPeopleSearchTerminal() {
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [results, setResults] = useState<PersonSearchResult[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const canSubmit = (name.trim().length > 0 || dob.trim().length > 0) && !isPending;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setError("");
    setStatus("searching");

    startTransition(async () => {
      const response = await searchBureauPeople({
        name: name.trim(),
        dateOfBirth: dob.trim(),
      });

      if (!response.ok) {
        setStatus("error");
        setResults([]);
        setTruncated(false);
        setError(
          response.reason === "unauthorized"
            ? "Session expired. Sign in again to query the bureau index."
            : response.reason === "empty"
              ? "Enter a name or date of birth to query the bureau index."
              : "Invalid query parameters."
        );
        return;
      }

      setResults(response.results);
      setTruncated(response.truncated);
      setStatus(response.results.length === 0 ? "no-results" : "results");
    });
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-3xl flex-col items-center justify-start px-4 py-12 sm:py-16">
      {/* System header */}
      <div className="mb-10 max-w-2xl text-center">
        <div className="mb-5 flex flex-wrap items-center justify-center gap-3">
          <span
            className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_18px_rgba(239,68,68,0.95)]"
            aria-hidden
          />
          <span className="font-mono text-[11px] uppercase tracking-[0.34em] text-red-200">
            Bureau Intelligence Network
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-500">
            Live Query · Node BLB-NY-01
          </span>
        </div>
        <h1 className="text-4xl font-semibold tracking-[-0.02em] text-zinc-50 sm:text-5xl">
          Identity Database
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-zinc-400">
          Enter a subject name and (optionally) a date of birth to query the
          bureau index. Records resolve from the live operative archive.
        </p>
      </div>

      {/* Query terminal */}
      <form onSubmit={handleSubmit} className="w-full max-w-2xl">
        <div className="overflow-hidden rounded-[1.75rem] border border-red-950/60 bg-black/60 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <div className="border-b border-red-950/60 bg-red-950/20 px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-red-200">
                Query Terminal
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500">
                Encrypted · TLS Verified
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-6 sm:grid-cols-[1.5fr_1fr]">
            <TerminalInput
              label="Subject Name"
              code="FN/LN"
              value={name}
              onChange={setName}
              placeholder="Leah Morn"
              autoFocus
            />
            <TerminalInput
              label="Date of Birth"
              code="DOB"
              value={dob}
              onChange={setDob}
              placeholder="1990-11-03"
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-red-950/60 bg-zinc-950/80 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.26em]">
              <StatusReadout status={status} resultCount={results.length} truncated={truncated} />
            </div>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-2xl bg-amber-400 px-5 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Querying..." : "Run Query"}
            </button>
          </div>
        </div>

        {status === "error" && error ? (
          <p
            role="alert"
            className="mt-4 text-center font-mono text-xs uppercase tracking-[0.22em] text-red-400"
          >
            {error}
          </p>
        ) : null}
      </form>

      {/* Results pane — only visible after a query */}
      {(status === "results" || status === "no-results") && (
        <div className="mt-10 w-full max-w-2xl">
          {status === "no-results" ? (
            <NoMatchCard />
          ) : (
            <div className="space-y-4">
              {results.map((person) => (
                <ResultCard key={person.id} person={person} />
              ))}
              {truncated ? (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-3 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-amber-300">
                  Showing 10 of N · refine query to narrow
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Bureau footer link — return path */}
      <div className="mt-12">
        <Link
          href="/bureau"
          className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-600 transition hover:text-zinc-300"
        >
          ← Return to Bureau
        </Link>
      </div>
    </div>
  );
}

function TerminalInput({
  label,
  code,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  label: string;
  code: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.22em] text-zinc-500">
          {label}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-red-300/80">
          {code}
        </span>
      </div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full rounded-2xl border border-zinc-800 bg-[#050507] px-4 py-3 font-mono text-sm text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-red-400/60 focus:bg-black focus:ring-2 focus:ring-red-500/10"
      />
    </label>
  );
}

function StatusReadout({
  status,
  resultCount,
  truncated,
}: {
  status: Status;
  resultCount: number;
  truncated: boolean;
}) {
  if (status === "idle") {
    return <span className="text-zinc-500">Awaiting Query</span>;
  }
  if (status === "searching") {
    return (
      <span className="inline-flex items-center gap-2 text-red-300">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
        Querying Bureau Index...
      </span>
    );
  }
  if (status === "results") {
    const label = resultCount === 1 ? "Match" : "Matches";
    return (
      <span className="inline-flex items-center gap-2 text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        {resultCount} {label} Returned{truncated ? " (Truncated)" : ""}
      </span>
    );
  }
  if (status === "no-results") {
    return (
      <span className="inline-flex items-center gap-2 text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        No Match In Bureau Index
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-red-400">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      Query Error
    </span>
  );
}

function NoMatchCard() {
  return (
    <div className="rounded-[1.75rem] border border-amber-500/30 bg-black/60 p-8 text-center shadow-2xl shadow-black/30 backdrop-blur-xl">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-amber-300">
        Result · Null Set
      </div>
      <h2 className="mb-3 text-2xl font-semibold text-white">
        No subject profile matches.
      </h2>
      <p className="mx-auto max-w-md text-sm leading-6 text-zinc-400">
        Verify spelling, try a known alias, or broaden the date of birth. The
        bureau index returned no candidate identities for this query.
      </p>
    </div>
  );
}

function ResultCard({ person }: { person: PersonSearchResult }) {
  const classificationTone =
    person.classification === "RESTRICTED"
      ? "border-red-500/40 bg-red-500/10 text-red-200"
      : person.classification === "BLACK_LEDGER_INTERNAL"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
        : "border-zinc-700 bg-zinc-950 text-zinc-300";

  const riskTone =
    person.riskLevel === "HIGH"
      ? "border-red-500/40 bg-red-500/10 text-red-200"
      : person.riskLevel === "MEDIUM" || person.riskLevel === "UNKNOWN"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";

  return (
    <div className="group rounded-[1.75rem] border border-zinc-800 bg-[#09090b] p-5 transition hover:border-amber-400/40 hover:bg-[#0c0c10]">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-amber-300">
            {person.bureauId}
          </div>
          <div className="mt-1.5 text-xl font-semibold text-zinc-50">
            {person.fullName}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Tag label={person.classification} className={classificationTone} />
            <Tag label={`Risk ${person.riskLevel}`} className={riskTone} />
            {person.dateOfBirth ? (
              <Tag
                label={`DOB ${person.dateOfBirth}`}
                className="border-zinc-700 bg-zinc-950 text-zinc-400"
              />
            ) : null}
          </div>
        </div>

        <Link
          href={`/bureau/people/${person.id}`}
          className="rounded-2xl bg-amber-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300"
        >
          Open File →
        </Link>
      </div>
    </div>
  );
}

function Tag({ label, className }: { label: string; className: string }) {
  return (
    <span className={`rounded-full border px-3 py-1 text-xs ${className}`}>
      {label}
    </span>
  );
}
