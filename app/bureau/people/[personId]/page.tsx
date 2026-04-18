import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Reveal from "@/components/ui/Reveal";

type PageProps = {
  params: Promise<{
    personId: string;
  }>;
};

export default async function BureauPersonProfilePage({ params }: PageProps) {
  const { personId } = await params;
  const parsedPersonId = Number(personId);

  if (!Number.isInteger(parsedPersonId)) {
    notFound();
  }

  const session = await auth();

  if (!session?.user) {
    notFound();
  }

  const person = await prisma.globalPerson.findUnique({
    where: { id: parsedPersonId },
    include: {
      aliases: true,
      caseAppearances: {
        include: {
          caseFile: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      sourceConnections: {
        include: {
          targetPerson: true,
        },
      },
      targetConnections: {
        include: {
          sourcePerson: true,
        },
      },
    },
  });

  if (!person) {
    notFound();
  }

  const connections = [
    ...person.sourceConnections.map((connection) => ({
      id: connection.id,
      person: connection.targetPerson,
      type: connection.connectionType,
      summary: connection.summary,
    })),
    ...person.targetConnections.map((connection) => ({
      id: connection.id,
      person: connection.sourcePerson,
      type: connection.connectionType,
      summary: connection.summary,
    })),
  ];

  return (
    <main className="bg-zinc-950 text-white">
      <section className="relative overflow-hidden border-b border-zinc-900 py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_35%)]" />

        <div className="relative mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="text-xs uppercase tracking-[0.35em] text-amber-300">
              Bureau Person Record
            </div>

            <div className="mt-6 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
                <div className="flex aspect-square items-center justify-center rounded-[1.5rem] border border-zinc-800 bg-zinc-950">
                  <div className="text-center">
                    <div className="text-5xl font-semibold text-zinc-700">
                      {person.firstName.charAt(0)}
                      {person.lastName.charAt(0)}
                    </div>
                    <div className="mt-3 text-xs uppercase tracking-[0.3em] text-zinc-600">
                      No Image
                    </div>
                  </div>
                </div>

                <div className="mt-6 text-xs uppercase tracking-[0.3em] text-zinc-500">
                  {person.bureauId}
                </div>

                <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
                  {person.fullName}
                </h1>

                <p className="mt-4 text-sm leading-7 text-zinc-300">
                  {person.profileSummary}
                </p>
              </div>

              <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Meta label="Status" value={person.status} />
                  <Meta label="Type" value={person.personType} />
                  <Meta label="Classification" value={person.classification} />
                  <Meta label="Risk Level" value={person.riskLevel} />
                  <Meta label="Relevance" value={person.relevanceLevel} />
                  <Meta label="DOB" value={person.dateOfBirth ?? "Unknown"} />
                  <Meta label="Known Location" value={person.knownLocation ?? "Unknown"} />
                  <Meta label="Last Updated" value={person.lastUpdatedLabel} />
                </div>

                {person.aliases.length > 0 ? (
                  <div className="mt-8">
                    <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                      Known Aliases
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {person.aliases.map((alias) => (
                        <span
                          key={alias.id}
                          className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300"
                        >
                          {alias.alias}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-8">
                  <Link
                    href="/bureau/database"
                    className="inline-flex rounded-2xl bg-white px-5 py-3 font-semibold text-zinc-950 transition hover:bg-zinc-200"
                  >
                    Back to Global Database
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-b border-zinc-900 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              Case Connections
            </div>

            {person.caseAppearances.length === 0 ? (
              <div className="mt-6 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8 text-sm text-zinc-400">
                No visible case connections indexed.
              </div>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {person.caseAppearances.map((appearance) => (
                  <div
                    key={appearance.id}
                    className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6"
                  >
                    <div className="text-sm text-zinc-400">
                      {appearance.role}
                    </div>

                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      {appearance.caseFile.title}
                    </h2>

                    <p className="mt-4 text-sm leading-7 text-zinc-300">
                      {appearance.summary}
                    </p>

                    <Link
                      href={`/bureau/cases/${appearance.caseFile.slug}`}
                      className="mt-5 inline-flex rounded-2xl border border-zinc-700 px-5 py-3 font-semibold text-white transition hover:bg-zinc-950"
                    >
                      Open Case Workspace
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </Reveal>
        </div>
      </section>

      <section className="border-b border-zinc-900 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              Known Connections
            </div>

            {connections.length === 0 ? (
              <div className="mt-6 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8 text-sm text-zinc-400">
                No person-to-person connections indexed.
              </div>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {connections.map((connection) => (
                  <Link
                    key={connection.id}
                    href={`/bureau/people/${connection.person.id}`}
                    className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6 transition hover:border-amber-500/40"
                  >
                    <div className="text-sm uppercase tracking-[0.2em] text-zinc-500">
                      {connection.type}
                    </div>

                    <h2 className="mt-3 text-2xl font-semibold text-white">
                      {connection.person.fullName}
                    </h2>

                    <p className="mt-4 text-sm leading-7 text-zinc-300">
                      {connection.summary || connection.person.profileSummary}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </Reveal>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Internal Notes
              </div>

              <p className="mt-5 whitespace-pre-line text-base leading-8 text-zinc-300">
                {person.internalNotes || "No internal notes available."}
              </p>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-zinc-200">
        {value}
      </div>
    </div>
  );
}