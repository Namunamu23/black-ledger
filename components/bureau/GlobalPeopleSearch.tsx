"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type PersonSearchItem = {
  id: number;
  bureauId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string | null;
  knownLocation: string | null;
  status: string;
  personType: string;
  classification: string;
  riskLevel: string;
  relevanceLevel: string;
  profileSummary: string;
  aliases: { alias: string }[];
  caseAppearances: {
    role: string;
    caseFile: {
      title: string;
      slug: string;
    };
  }[];
};

type GlobalPeopleSearchProps = {
  people: PersonSearchItem[];
};

function clean(value: string) {
  return value.toLowerCase().trim();
}

function hasValue(value: string) {
  return value.trim().length > 0;
}

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function classificationTone(classification: string) {
  if (classification === "RESTRICTED") {
    return "border-red-500/40 bg-red-500/10 text-red-200";
  }

  if (classification === "BLACK_LEDGER_INTERNAL") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  }

  return "border-zinc-700 bg-zinc-950 text-zinc-300";
}

function riskTone(risk: string) {
  if (risk === "HIGH") {
    return "border-red-500/40 bg-red-500/10 text-red-200";
  }

  if (risk === "MEDIUM" || risk === "UNKNOWN") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  }

  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
}

export default function GlobalPeopleSearch({ people }: GlobalPeopleSearchProps) {
  const [filters, setFilters] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    alias: "",
    caseConnection: "",
    personType: "",
    knownLocation: "",
    classification: "",
  });

  function updateFilter(name: keyof typeof filters, value: string) {
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  function clearFilters() {
    setFilters({
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      alias: "",
      caseConnection: "",
      personType: "",
      knownLocation: "",
      classification: "",
    });
  }

  const activeFilterCount = Object.values(filters).filter(hasValue).length;

  const filteredPeople = useMemo(() => {
    return people.filter((person) => {
      const aliasText = person.aliases.map((item) => item.alias).join(" ");
      const caseText = person.caseAppearances
        .map((item) => `${item.caseFile.title} ${item.caseFile.slug} ${item.role}`)
        .join(" ");

      const checks = [
        [filters.firstName, person.firstName],
        [filters.lastName, person.lastName],
        [filters.dateOfBirth, person.dateOfBirth ?? ""],
        [filters.alias, aliasText],
        [filters.caseConnection, caseText],
        [filters.personType, person.personType],
        [filters.knownLocation, person.knownLocation ?? ""],
        [filters.classification, person.classification],
      ] as const;

      return checks.every(([needle, haystack]) => {
        if (!needle.trim()) return true;
        return clean(haystack).includes(clean(needle));
      });
    });
  }, [filters, people]);

  const restrictedMatches = filteredPeople.filter(
    (person) => person.classification === "RESTRICTED"
  ).length;

  const aliasMatches = filteredPeople.reduce(
    (total, person) => total + person.aliases.length,
    0
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr_320px]">
      <aside className="xl:sticky xl:top-24 xl:self-start">
        <div className="overflow-hidden rounded-[1.75rem] border border-red-950/60 bg-black/65 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <div className="border-b border-red-950/60 bg-red-950/20 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_18px_rgba(239,68,68,0.95)]" />
              <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-red-200">
                Query Control
              </div>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <TerminalInput
              label="First Name"
              code="FN"
              value={filters.firstName}
              placeholder="Leah"
              onChange={(value) => updateFilter("firstName", value)}
            />
            <TerminalInput
              label="Last Name"
              code="LN"
              value={filters.lastName}
              placeholder="Morn"
              onChange={(value) => updateFilter("lastName", value)}
            />
            <TerminalInput
              label="Date of Birth"
              code="DOB"
              value={filters.dateOfBirth}
              placeholder="1990-11-03"
              onChange={(value) => updateFilter("dateOfBirth", value)}
            />
            <TerminalInput
              label="Alias"
              code="AKA"
              value={filters.alias}
              placeholder="L. Morn"
              onChange={(value) => updateFilter("alias", value)}
            />
            <TerminalInput
              label="Case Connection"
              code="CASE"
              value={filters.caseConnection}
              placeholder="Alder"
              onChange={(value) => updateFilter("caseConnection", value)}
            />
            <TerminalInput
              label="Person Type"
              code="TYPE"
              value={filters.personType}
              placeholder="VICTIM"
              onChange={(value) => updateFilter("personType", value)}
            />
            <TerminalInput
              label="Known Location"
              code="LOC"
              value={filters.knownLocation}
              placeholder="Museum"
              onChange={(value) => updateFilter("knownLocation", value)}
            />
            <TerminalInput
              label="Classification"
              code="CLASS"
              value={filters.classification}
              placeholder="RESTRICTED"
              onChange={(value) => updateFilter("classification", value)}
            />

            <button
              type="button"
              onClick={clearFilters}
              className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 font-mono text-xs font-semibold uppercase tracking-[0.22em] text-zinc-300 transition hover:border-amber-400/50 hover:bg-zinc-900 hover:text-amber-200"
            >
              Clear Query Stack
            </button>
          </div>
        </div>
      </aside>

      <section className="min-w-0">
        <div className="mb-5 overflow-hidden rounded-[1.75rem] border border-zinc-800 bg-black/60 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="border-b border-zinc-800 bg-zinc-950/80 px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.34em] text-amber-300">
                  System Output
                </div>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                  Identity Records Matched
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                <OutputPill label={`${filteredPeople.length} records`} tone="amber" />
                <OutputPill label={`${activeFilterCount} filters`} tone="zinc" />
                <OutputPill label={`${restrictedMatches} restricted`} tone="red" />
              </div>
            </div>
          </div>

          <div className="grid border-b border-zinc-800 sm:grid-cols-3">
            <OutputReadout label="Scan State" value="COMPLETE" />
            <OutputReadout label="Alias Hits" value={aliasMatches.toString()} />
            <OutputReadout label="Confidence Mode" value="PARTIAL MATCH" />
          </div>
        </div>

        {filteredPeople.length === 0 ? (
          <div className="overflow-hidden rounded-[1.75rem] border border-red-950/60 bg-black/70 shadow-2xl shadow-black/40">
            <div className="border-b border-red-950/60 bg-red-950/20 px-6 py-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-red-200">
                No Records Returned
              </div>
            </div>

            <div className="p-8">
              <h3 className="text-3xl font-semibold text-white">
                No identity file matched the current query.
              </h3>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300">
                The bureau index found no subject profile matching this
                combination of identifiers. Reduce active filters, check alias
                spelling, or search by a broader case connection.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-5">
            {filteredPeople.map((person, index) => (
              <SubjectFileCard key={person.id} person={person} index={index} />
            ))}
          </div>
        )}
      </section>

      <aside className="xl:sticky xl:top-24 xl:self-start">
        <div className="overflow-hidden rounded-[1.75rem] border border-cyan-950/60 bg-black/65 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <div className="border-b border-cyan-950/70 bg-cyan-950/20 px-5 py-4">
            <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-200">
              Intelligence Monitor
            </div>
          </div>

          <div className="space-y-4 p-5">
            <MonitorRow label="Visible Records" value={filteredPeople.length.toString()} />
            <MonitorRow label="Indexed Profiles" value={people.length.toString()} />
            <MonitorRow label="Restricted Matches" value={restrictedMatches.toString()} />
            <MonitorRow label="Active Filters" value={activeFilterCount.toString()} />

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-zinc-500">
                Analyst Note
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                Global results may include decoys, background profiles,
                unresolved subjects, and future-case continuity markers. Not
                every indexed identity is directly relevant to the currently
                activated case.
              </p>
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-amber-300">
                Case Universe Warning
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                Cross-case intelligence can contain red herrings and partial
                context. Treat matches as investigative leads, not final proof.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function TerminalInput({
  label,
  code,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  code: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
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
        className="w-full rounded-2xl border border-zinc-800 bg-[#050507] px-4 py-3 font-mono text-sm text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-red-400/60 focus:bg-black focus:ring-2 focus:ring-red-500/10"
      />
    </label>
  );
}

function SubjectFileCard({
  person,
  index,
}: {
  person: PersonSearchItem;
  index: number;
}) {
  const connectedCases = person.caseAppearances.slice(0, 3);
  const confidence = Math.max(62, 97 - index * 7);

  return (
    <Link
      href={`/bureau/people/${person.id}`}
      className="group relative overflow-hidden rounded-[1.75rem] border border-zinc-800 bg-[#09090b] shadow-2xl shadow-black/30 transition hover:border-red-400/40 hover:bg-[#0c0c10]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(239,68,68,0.12),transparent_24%),radial-gradient(circle_at_100%_20%,rgba(14,165,233,0.08),transparent_22%)] opacity-80" />
      <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-red-500 via-amber-400 to-zinc-900" />
      <div className="absolute right-6 top-5 hidden rotate-2 border border-red-500/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.28em] text-red-300/70 sm:block">
        Subject File
      </div>

      <div className="relative grid gap-0 lg:grid-cols-[112px_1fr_280px]">
        <div className="border-b border-zinc-800 bg-black/35 p-5 lg:border-b-0 lg:border-r">
          <div className="flex h-[112px] w-[112px] items-center justify-center rounded-[1.35rem] border border-zinc-800 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.14),rgba(0,0,0,0.9)_60%)]">
            <div className="text-center">
              <div className="text-4xl font-semibold tracking-tight text-zinc-500">
                {initials(person.firstName, person.lastName)}
              </div>
              <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.22em] text-zinc-700">
                No Image
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-[0.28em] text-amber-300">
              {person.bureauId}
            </span>
            <Tag label={person.classification} className={classificationTone(person.classification)} />
            <Tag label={`Risk ${person.riskLevel}`} className={riskTone(person.riskLevel)} />
          </div>

          <h3 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-50 group-hover:text-amber-100">
            {person.fullName}
          </h3>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300">
            {person.profileSummary ||
              "No profile summary has been indexed for this identity record."}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Tag label={person.status} />
            <Tag label={person.personType} />
            <Tag label={person.relevanceLevel} />
            {person.knownLocation ? <Tag label={person.knownLocation} /> : null}
          </div>

          {person.aliases.length > 0 ? (
            <div className="mt-5 border-t border-zinc-800 pt-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-zinc-500">
                Known Alias Markers
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {person.aliases.map((alias) => (
                  <span
                    key={alias.alias}
                    className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200"
                  >
                    {alias.alias}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-zinc-800 bg-black/35 p-5 lg:border-l lg:border-t-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-500">
            Match Confidence
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-900">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-cyan-300"
              style={{ width: `${confidence}%` }}
            />
          </div>

          <div className="mt-2 font-mono text-xs text-zinc-400">
            {confidence}% profile alignment
          </div>

          <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-500">
            Case Linkage
          </div>

          {connectedCases.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              No visible case linkage indexed.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {connectedCases.map((appearance) => (
                <div
                  key={`${appearance.caseFile.slug}-${appearance.role}`}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3"
                >
                  <div className="text-sm font-medium text-zinc-200">
                    {appearance.caseFile.title}
                  </div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                    {appearance.role}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 inline-flex w-full justify-center rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-950 transition group-hover:bg-amber-300">
            Open Subject File
          </div>
        </div>
      </div>
    </Link>
  );
}

function Tag({
  label,
  className = "border-zinc-700 bg-zinc-950 text-zinc-300",
}: {
  label: string;
  className?: string;
}) {
  return (
    <span className={`rounded-full border px-3 py-1 text-xs ${className}`}>
      {label}
    </span>
  );
}

function OutputPill({
  label,
  tone,
}: {
  label: string;
  tone: "red" | "amber" | "zinc";
}) {
  const className = {
    red: "border-red-500/30 bg-red-500/10 text-red-200",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    zinc: "border-zinc-700 bg-zinc-950 text-zinc-300",
  }[tone];

  return (
    <span className={`rounded-full border px-3 py-1 text-xs ${className}`}>
      {label}
    </span>
  );
}

function OutputReadout({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-zinc-800 bg-black/30 px-5 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-zinc-600">
        {label}
      </div>
      <div className="mt-2 font-mono text-xs uppercase tracking-[0.18em] text-zinc-300">
        {value}
      </div>
    </div>
  );
}

function MonitorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500">
        {label}
      </div>
      <div className="font-mono text-sm text-zinc-100">{value}</div>
    </div>
  );
}