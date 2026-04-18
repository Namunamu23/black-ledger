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

  return (
    <div className="grid gap-8">
      <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.35em] text-amber-300">
              Black Ledger Bureau
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-white">
              Person Intelligence Search
            </h2>
          </div>

          <div className="rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-xs uppercase tracking-[0.2em] text-zinc-400">
            Secure Analyst Interface
          </div>
        </div>

        <p className="mt-5 max-w-3xl text-sm leading-7 text-zinc-300">
          Search known persons, aliases, victims, suspects, witnesses, decoys,
          associates, and unresolved subjects across the Black Ledger universe.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <input
            value={filters.firstName}
            onChange={(e) => updateFilter("firstName", e.target.value)}
            placeholder="First name"
            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
          />

          <input
            value={filters.lastName}
            onChange={(e) => updateFilter("lastName", e.target.value)}
            placeholder="Last name"
            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
          />

          <input
            value={filters.dateOfBirth}
            onChange={(e) => updateFilter("dateOfBirth", e.target.value)}
            placeholder="Date of birth"
            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
          />

          <input
            value={filters.alias}
            onChange={(e) => updateFilter("alias", e.target.value)}
            placeholder="Alias"
            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
          />

          <input
            value={filters.caseConnection}
            onChange={(e) => updateFilter("caseConnection", e.target.value)}
            placeholder="Case connection"
            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
          />

          <input
            value={filters.personType}
            onChange={(e) => updateFilter("personType", e.target.value)}
            placeholder="Person type"
            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
          />

          <input
            value={filters.knownLocation}
            onChange={(e) => updateFilter("knownLocation", e.target.value)}
            placeholder="Known location"
            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
          />

          <input
            value={filters.classification}
            onChange={(e) => updateFilter("classification", e.target.value)}
            placeholder="Classification"
            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-3 text-xs text-zinc-500">
          <span>{filteredPeople.length} profiles matched</span>
          <span>•</span>
          <span>{people.length} profiles indexed</span>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredPeople.map((person) => (
          <Link
            key={person.id}
            href={`/bureau/people/${person.id}`}
            className="group rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6 transition hover:border-amber-500/40 hover:bg-zinc-900/80"
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                  {person.bureauId}
                </div>

                <h3 className="mt-3 text-3xl font-semibold text-white group-hover:text-amber-100">
                  {person.fullName}
                </h3>

                <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300">
                  {person.profileSummary}
                </p>

                {person.aliases.length > 0 ? (
                  <div className="mt-4 text-sm text-zinc-400">
                    Aliases: {person.aliases.map((item) => item.alias).join(", ")}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
                <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
                  {person.status}
                </span>
                <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
                  {person.personType}
                </span>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
                  {person.classification}
                </span>
              </div>
            </div>
          </Link>
        ))}

        {filteredPeople.length === 0 ? (
          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8 text-sm text-zinc-400">
            No matching bureau profiles found.
          </div>
        ) : null}
      </div>
    </div>
  );
}