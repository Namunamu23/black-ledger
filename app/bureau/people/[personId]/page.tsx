import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

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
  const userId = Number((session?.user as { id?: string } | undefined)?.id);

  if (!session?.user || !Number.isInteger(userId)) {
    notFound();
  }

  const [person, ownedCases] = await Promise.all([
    prisma.globalPerson.findUnique({
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
    }),
    prisma.userCase.findMany({
      where: { userId },
      include: {
        caseFile: true,
      },
    }),
  ]);

  if (!person) {
    notFound();
  }

  const ownedCaseSlugs = new Set(
    ownedCases.map((entry) => entry.caseFile.slug)
  );

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

  const updateDate = person.updatedAt.toISOString().slice(0, 10);

  return (
    <main className="min-h-screen overflow-hidden bg-[#050507] text-zinc-100">
      <section className="relative border-b border-red-950/50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(185,28,28,0.24),transparent_30%),radial-gradient(circle_at_85%_5%,rgba(14,116,144,0.16),transparent_28%),linear-gradient(to_bottom,#050507,#09090b_62%,#030304)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:54px_54px] opacity-25" />
        <div className="absolute inset-0 bg-[repeating-linear-gradient(to_bottom,rgba(255,255,255,0.035)_0px,rgba(255,255,255,0.035)_1px,transparent_1px,transparent_5px)] opacity-[0.04]" />

        <div className="relative mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-5 flex flex-wrap gap-3">
            <Link
              href="/bureau/database"
              className="rounded-2xl border border-zinc-700 bg-black/60 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:border-amber-400/50 hover:bg-zinc-900"
            >
              Return to Database
            </Link>

            <Link
              href="/bureau"
              className="rounded-2xl border border-zinc-700 bg-black/60 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:border-cyan-400/50 hover:bg-zinc-900"
            >
              Bureau Dashboard
            </Link>
          </div>

          <div className="overflow-hidden rounded-[1.75rem] border border-red-950/60 bg-black/65 shadow-2xl shadow-black/60 backdrop-blur-xl">
            <div className="border-b border-red-950/70 bg-gradient-to-r from-red-950/35 via-zinc-950 to-cyan-950/20 px-5 py-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_22px_rgba(239,68,68,0.95)]" />
                  <span className="font-mono text-[11px] uppercase tracking-[0.34em] text-red-200">
                    Classified Subject Dossier
                  </span>
                  <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-red-200">
                    {person.classification}
                  </span>
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-amber-200">
                    {person.bureauId}
                  </span>
                </div>

                <div className="font-mono text-[11px] uppercase tracking-[0.26em] text-zinc-500">
                  Last indexed update / {updateDate}
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-[390px_1fr]">
              <aside className="border-b border-red-950/50 bg-black/35 p-6 lg:border-b-0 lg:border-r">
                <div className="rounded-[1.5rem] border border-zinc-800 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.16),rgba(0,0,0,0.94)_62%)] p-6">
                  <div className="flex aspect-square items-center justify-center rounded-[1.25rem] border border-zinc-800 bg-black/65">
                    <div className="text-center">
                      <div className="text-8xl font-semibold tracking-tight text-zinc-600">
                        {person.firstName.charAt(0)}
                        {person.lastName.charAt(0)}
                      </div>
                      <div className="mt-5 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-700">
                        Image Not Indexed
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3">
                    <DossierReadout label="Bureau ID" value={person.bureauId} />
                    <DossierReadout label="Status" value={person.status} />
                    <DossierReadout label="Risk Level" value={person.riskLevel} />
                    <DossierReadout label="Relevance" value={person.relevanceLevel} />
                  </div>
                </div>
              </aside>

              <section className="p-6 lg:p-8">
                <div className="grid gap-8 xl:grid-cols-[1fr_340px]">
                  <div>
                    <div className="font-mono text-xs uppercase tracking-[0.45em] text-amber-300">
                      Black Ledger Identity File
                    </div>

                    <h1 className="mt-5 text-5xl font-semibold tracking-[-0.055em] text-white sm:text-7xl">
                      {person.fullName}
                    </h1>

                    <p className="mt-6 max-w-4xl text-base leading-8 text-zinc-300">
                      {person.profileSummary ||
                        "No profile summary has been indexed for this subject."}
                    </p>

                    <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <MetaTile label="First Name" value={person.firstName} />
                      <MetaTile label="Last Name" value={person.lastName} />
                      <MetaTile label="Date of Birth" value={person.dateOfBirth ?? "Unknown"} />
                      <MetaTile label="Known Location" value={person.knownLocation ?? "Unknown"} />
                      <MetaTile label="Person Type" value={person.personType} />
                      <MetaTile label="Classification" value={person.classification} />
                      <MetaTile label="Access Label" value={person.lastUpdatedLabel} />
                      <MetaTile label="Updated" value={updateDate} />
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-zinc-800 bg-black/45 p-5">
                    <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                      Alias Registry
                    </div>

                    {person.aliases.length === 0 ? (
                      <p className="mt-4 text-sm leading-6 text-zinc-500">
                        No known aliases indexed for this subject.
                      </p>
                    ) : (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {person.aliases.map((alias) => (
                          <span
                            key={alias.id}
                            className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200"
                          >
                            {alias.alias}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-6 border-t border-zinc-800 pt-5">
                      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                        File Warning
                      </div>
                      <p className="mt-3 text-sm leading-6 text-zinc-300">
                        Identity records may include incomplete, decoy, or
                        cross-case intelligence. Treat profile data as a lead
                        system, not a confession system.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>

      <section className="relative border-b border-zinc-900 py-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(245,158,11,0.08),transparent_30%)]" />

        <div className="relative mx-auto grid max-w-[1600px] gap-5 px-4 sm:px-6 lg:grid-cols-[1fr_0.85fr] lg:px-8">
          <Panel
            eyebrow="Case Linkage"
            title="Indexed case appearances"
            text="Known file relationships between this identity record and active or archived Black Ledger investigations."
          >
            {person.caseAppearances.length === 0 ? (
              <EmptyState
                title="No case appearances indexed"
                text="This subject may exist as background intelligence, continuity infrastructure, or a future-case reference."
              />
            ) : (
              <div className="grid gap-4">
                {person.caseAppearances.map((appearance) => {
                  const ownsCase = ownedCaseSlugs.has(appearance.caseFile.slug);

                  return (
                    <div
                      key={appearance.id}
                      className="rounded-[1.35rem] border border-zinc-800 bg-black/45 p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-amber-300">
                          {appearance.role}
                        </div>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs ${
                            ownsCase
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                              : "border-red-500/30 bg-red-500/10 text-red-200"
                          }`}
                        >
                          {ownsCase ? "Workspace Accessible" : "Case Access Required"}
                        </span>
                      </div>

                      <h3 className="mt-4 text-2xl font-semibold text-white">
                        {appearance.caseFile.title}
                      </h3>

                      <p className="mt-4 text-sm leading-7 text-zinc-300">
                        {appearance.summary}
                      </p>

                      {ownsCase ? (
                        <div className="mt-5 flex flex-wrap gap-3">
                          <Link
                            href={`/bureau/cases/${appearance.caseFile.slug}`}
                            className="rounded-2xl bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300"
                          >
                            Open Workspace
                          </Link>

                          <Link
                            href={`/bureau/cases/${appearance.caseFile.slug}/database`}
                            className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:border-cyan-400/50 hover:bg-zinc-900"
                          >
                            Case Database
                          </Link>
                        </div>
                      ) : (
                        <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950/80 px-5 py-3 text-sm text-zinc-500">
                          Activate this case file before workspace access is granted.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel
            eyebrow="Identity Graph"
            title="Associated subject records"
            text="Person-to-person relationships indexed through the Black Ledger intelligence graph."
          >
            {connections.length === 0 ? (
              <EmptyState
                title="No associated profiles indexed"
                text="No verified person-to-person relationship graph exists for this subject yet."
              />
            ) : (
              <div className="grid gap-4">
                {connections.map((connection) => (
                  <Link
                    key={connection.id}
                    href={`/bureau/people/${connection.person.id}`}
                    className="rounded-[1.35rem] border border-zinc-800 bg-black/45 p-5 transition hover:border-amber-400/40 hover:bg-zinc-950"
                  >
                    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-300">
                      {connection.type}
                    </div>

                    <h3 className="mt-4 text-2xl font-semibold text-white">
                      {connection.person.fullName}
                    </h3>

                    <p className="mt-4 text-sm leading-7 text-zinc-300">
                      {connection.summary || connection.person.profileSummary}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </section>

      <section className="py-8">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-[1.75rem] border border-red-950/60 bg-black/65 shadow-2xl shadow-black/40">
            <div className="border-b border-red-950/60 bg-red-950/20 px-6 py-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.32em] text-red-200">
                Internal Investigator Notes
              </div>
            </div>

            <div className="p-7">
              <p className="whitespace-pre-line text-base leading-8 text-zinc-300">
                {person.internalNotes || "No internal notes available."}
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function DossierReadout({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black/50 p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-zinc-600">
        {label}
      </div>
      <div className="mt-2 font-mono text-sm text-zinc-200">{value}</div>
    </div>
  );
}

function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black/45 p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-600">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-zinc-200">{value}</div>
    </div>
  );
}

function Panel({
  eyebrow,
  title,
  text,
  children,
}: {
  eyebrow: string;
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-zinc-800 bg-black/65 shadow-2xl shadow-black/40">
      <div className="border-b border-zinc-800 bg-zinc-950/80 px-6 py-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-zinc-500">
          {eyebrow}
        </div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
          {title}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300">
          {text}
        </p>
      </div>

      <div className="p-5">{children}</div>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[1.35rem] border border-zinc-800 bg-zinc-950/70 p-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-600">
        No Indexed Data
      </div>
      <h3 className="mt-4 text-2xl font-semibold text-white">{title}</h3>
      <p className="mt-4 text-sm leading-7 text-zinc-300">{text}</p>
    </div>
  );
}