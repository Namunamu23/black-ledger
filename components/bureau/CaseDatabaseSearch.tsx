"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type PersonItem = {
  id: number;
  name: string;
  role: string;
  summary: string;
  unlockStage: number;
};

type RecordItem = {
  id: number;
  title: string;
  category: string;
  summary: string;
  body: string;
  unlockStage: number;
};

type HintItem = {
  id: number;
  level: number;
  title: string;
  content: string;
  unlockStage: number;
};

type CaseDatabaseSearchProps = {
  slug: string;
  currentStage: number;
  people: PersonItem[];
  records: RecordItem[];
  hints: HintItem[];
};

function normalize(value: string) {
  return value.toLowerCase().trim();
}

export default function CaseDatabaseSearch({
  slug,
  currentStage,
  people,
  records,
  hints,
}: CaseDatabaseSearchProps) {
  const [query, setQuery] = useState("");

  const normalizedQuery = normalize(query);

  const filteredPeople = useMemo(() => {
    if (!normalizedQuery) return people;

    return people.filter((person) => {
      const haystack = normalize(`${person.name} ${person.role} ${person.summary}`);
      return haystack.includes(normalizedQuery);
    });
  }, [people, normalizedQuery]);

  const filteredRecords = useMemo(() => {
    if (!normalizedQuery) return records;

    return records.filter((record) => {
      const haystack = normalize(
        `${record.title} ${record.category} ${record.summary} ${record.body}`
      );
      return haystack.includes(normalizedQuery);
    });
  }, [records, normalizedQuery]);

  const filteredHints = useMemo(() => {
    if (!normalizedQuery) return hints;

    return hints.filter((hint) => {
      const haystack = normalize(`${hint.title} ${hint.content}`);
      return haystack.includes(normalizedQuery);
    });
  }, [hints, normalizedQuery]);

  const totalResults =
    filteredPeople.length + filteredRecords.length + filteredHints.length;

  return (
    <div className="grid gap-8">
      <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
          Bureau Search
        </div>

        <h2 className="mt-4 text-3xl font-semibold text-white">
          Search unlocked case data
        </h2>

        <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300">
          Search people, evidence records, and unlocked hints for this case.
          Results only include content available through Stage {currentStage}.
        </p>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search names, records, evidence, or keywords..."
          className="mt-6 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
        />

        <div className="mt-3 text-sm text-zinc-500">
          {totalResults} result{totalResults === 1 ? "" : "s"} found
        </div>
      </div>

      <section>
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
          People of Interest
        </div>

        {filteredPeople.length === 0 ? (
          <div className="mt-4 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-400">
            No matching people found.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {filteredPeople.map((person) => (
              <div
                key={person.id}
                className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6"
              >
                <div className="text-sm text-zinc-400">{person.role}</div>
                <h3 className="mt-2 text-2xl font-semibold text-white">
                  {person.name}
                </h3>
                <p className="mt-4 text-sm leading-7 text-zinc-300">
                  {person.summary}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
          Evidence Records
        </div>

        {filteredRecords.length === 0 ? (
          <div className="mt-4 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-400">
            No matching records found.
          </div>
        ) : (
          <div className="mt-4 grid gap-4">
            {filteredRecords.map((record) => (
              <div
                key={record.id}
                className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6"
              >
                <div className="text-sm uppercase tracking-[0.2em] text-zinc-500">
                  {record.category}
                </div>

                <h3 className="mt-3 text-2xl font-semibold text-white">
                  {record.title}
                </h3>

                <p className="mt-4 text-sm leading-7 text-zinc-300">
                  {record.summary}
                </p>

                <Link
                  href={`/bureau/cases/${slug}/records/${record.id}`}
                  className="mt-5 inline-flex rounded-2xl bg-white px-5 py-3 font-semibold text-zinc-950 transition hover:bg-zinc-200"
                >
                  Open Record
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
          Bureau Hints
        </div>

        {filteredHints.length === 0 ? (
          <div className="mt-4 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-400">
            No matching hints found.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {filteredHints.map((hint) => (
              <div
                key={hint.id}
                className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6"
              >
                <div className="text-xs uppercase tracking-[0.25em] text-amber-300">
                  Level {hint.level}
                </div>

                <h3 className="mt-4 text-xl font-semibold text-white">
                  {hint.title}
                </h3>

                <p className="mt-4 text-sm leading-7 text-zinc-300">
                  {hint.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}