import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

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
        behavioralProfile: true,
        digitalTraces: {
          orderBy: { sortOrder: "asc" },
        },
        timelineEvents: {
          orderBy: { sortOrder: "asc" },
        },
        evidenceLinks: {
          orderBy: { sortOrder: "asc" },
        },
        analystNotes: {
          orderBy: { sortOrder: "asc" },
        },
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

  const age = getApproximateAge(person.dateOfBirth);
  const updateDate = person.updatedAt.toISOString().slice(0, 10);

  return (
    <main className="min-h-screen overflow-hidden bg-[#050507] text-zinc-100">
      <section className="relative border-b border-red-950/50">
        <Backdrop />

        <div className="relative mx-auto max-w-[1700px] px-4 py-6 sm:px-6 lg:px-8">
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

          <div className="overflow-hidden rounded-[1.75rem] border border-red-950/60 bg-black/70 shadow-2xl shadow-black/60 backdrop-blur-xl">
            <div className="border-b border-red-950/70 bg-gradient-to-r from-red-950/40 via-zinc-950 to-cyan-950/20 px-5 py-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_22px_rgba(239,68,68,0.95)]" />
                  <span className="font-mono text-[11px] uppercase tracking-[0.34em] text-red-200">
                    Classified Subject Dossier
                  </span>
                  <SystemBadge tone="red">{person.classification}</SystemBadge>
                  <SystemBadge tone="amber">{person.bureauId}</SystemBadge>
                  <SystemBadge tone="cyan">{person.watchlistFlag}</SystemBadge>
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
                    <DossierReadout label="Subject Status" value={person.status} />
                    <DossierReadout label="Risk Level" value={person.riskLevel} />
                    <DossierReadout label="Relevance" value={person.relevanceLevel} />
                    <DossierReadout label="Access Level" value={person.accessLevel} />
                    <DossierReadout label="Source Reliability" value={person.sourceReliability} />
                  </div>
                </div>
              </aside>

              <section className="p-6 lg:p-8">
                <div className="grid gap-8 xl:grid-cols-[1fr_360px]">
                  <div>
                    <div className="font-mono text-xs uppercase tracking-[0.45em] text-amber-300">
                      Black Ledger Identity File
                    </div>

                    <h1 className="mt-5 text-5xl font-semibold tracking-[-0.055em] text-white sm:text-7xl">
                      {person.fullName}
                    </h1>

                    <p className="mt-6 max-w-5xl text-base leading-8 text-zinc-300">
                      {person.profileSummary ||
                        "No profile summary has been indexed for this subject."}
                    </p>

                    <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <MetaTile label="First Name" value={person.firstName} />
                      <MetaTile label="Last Name" value={person.lastName} />
                      <MetaTile label="Date of Birth" value={person.dateOfBirth ?? "Unknown"} />
                      <MetaTile label="Approx. Age" value={age} />
                      <MetaTile label="Gender" value={person.gender ?? "Unknown"} />
                      <MetaTile label="Known Location" value={person.knownLocation ?? "Unknown"} />
                      <MetaTile label="Person Type" value={person.personType} />
                      <MetaTile label="Confidence" value={person.confidenceLevel} />
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
                        Dossier contents may include partial intelligence,
                        unresolved leads, red herrings, and cross-case context.
                        Treat this file as an investigative aid, not a confession.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-8">
        <BackdropSoft />

        <div className="relative mx-auto grid max-w-[1700px] gap-5 px-4 sm:px-6 xl:grid-cols-[1fr_0.9fr] lg:px-8">
          <Panel
            eyebrow="Case Linkage"
            title="Indexed case appearances"
            text="Known file relationships between this identity record and active, archived, or future Black Ledger investigations."
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
            eyebrow="Behavioral Read"
            title="Profiler notes"
            text="Fictional investigative observations, motive threads, and escalation indicators. This is not a medical or clinical assessment."
          >
            {person.behavioralProfile ? (
              <div className="grid gap-4">
                <LargeReadout
                  label="Analyst Assessment"
                  value={person.behavioralProfile.analystAssessment}
                  tone="amber"
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <DossierBlock
                    label="Observed Patterns"
                    value={person.behavioralProfile.observedPatterns}
                  />
                  <DossierBlock
                    label="Stress Indicators"
                    value={person.behavioralProfile.stressIndicators}
                  />
                  <DossierBlock
                    label="Communication Style"
                    value={person.behavioralProfile.communicationStyle}
                  />
                  <DossierBlock
                    label="Social Behavior"
                    value={person.behavioralProfile.socialBehavior}
                  />
                  <DossierBlock
                    label="Conflict History"
                    value={person.behavioralProfile.conflictHistory}
                  />
                  <DossierBlock
                    label="Motive Threads"
                    value={person.behavioralProfile.motiveThreads}
                  />
                  <DossierBlock
                    label="Escalation Indicators"
                    value={person.behavioralProfile.escalationIndicators}
                  />
                  <DossierBlock
                    label="Analyst Confidence"
                    value={person.behavioralProfile.analystConfidence}
                  />
                </div>
              </div>
            ) : (
              <EmptyState
                title="No behavioral profile indexed"
                text="No profiler notes exist for this subject yet."
              />
            )}
          </Panel>

          <Panel
            eyebrow="Cyber Trace"
            title="Digital intelligence"
            text="Known usernames, device fragments, metadata hits, routing anomalies, and online markers connected to this subject."
          >
            {person.digitalTraces.length === 0 ? (
              <EmptyState
                title="No digital traces indexed"
                text="No device, account, alias, or metadata trace is currently attached to this subject file."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {person.digitalTraces.map((trace) => (
                  <div
                    key={trace.id}
                    className="rounded-[1.35rem] border border-cyan-500/20 bg-cyan-500/5 p-5"
                  >
                    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-300">
                      {trace.category}
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-white">
                      {trace.label}
                    </h3>
                    <div className="mt-3 rounded-xl border border-zinc-800 bg-black/50 p-3 font-mono text-xs text-zinc-300">
                      {trace.value}
                    </div>
                    <p className="mt-4 text-sm leading-7 text-zinc-300">
                      {trace.notes}
                    </p>
                    <Badge tone="cyan">Confidence: {trace.confidence}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            eyebrow="Evidence Linkage"
            title="Forensic and record associations"
            text="Physical, documentary, access, forensic, and chain-of-custody style references connected to this identity."
          >
            {person.evidenceLinks.length === 0 ? (
              <EmptyState
                title="No evidence links indexed"
                text="No evidence or forensic association is currently attached to this subject file."
              />
            ) : (
              <div className="grid gap-4">
                {person.evidenceLinks.map((link) => {
                  const ownsRelatedCase = link.relatedCaseSlug
                    ? ownedCaseSlugs.has(link.relatedCaseSlug)
                    : false;

                  return (
                    <div
                      key={link.id}
                      className="rounded-[1.35rem] border border-zinc-800 bg-black/45 p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-red-200">
                          {link.evidenceType}
                        </div>
                        <Badge tone="amber">Confidence: {link.confidence}</Badge>
                      </div>

                      <h3 className="mt-4 text-2xl font-semibold text-white">
                        {link.title}
                      </h3>

                      <p className="mt-4 text-sm leading-7 text-zinc-300">
                        {link.summary}
                      </p>

                      {link.relatedCaseSlug ? (
                        <div className="mt-5 flex flex-wrap gap-3">
                          {ownsRelatedCase ? (
                            <Link
                              href={`/bureau/cases/${link.relatedCaseSlug}/database`}
                              className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:border-cyan-400/50 hover:bg-zinc-900"
                            >
                              Open Related Case Database
                            </Link>
                          ) : (
                            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 px-5 py-3 text-sm text-zinc-500">
                              Related case access required.
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel
            eyebrow="Identity Graph"
            title="Associated subject records"
            text="Known contacts, linked identities, victims, suspects, witnesses, coworkers, and unresolved relationship lines."
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

          <Panel
            eyebrow="Activity Log"
            title="Subject timeline"
            text="Chronology of case mentions, evidence discoveries, digital activity, status changes, and unresolved movement markers."
          >
            {person.timelineEvents.length === 0 ? (
              <EmptyState
                title="No timeline events indexed"
                text="No activity log has been attached to this subject file yet."
              />
            ) : (
              <div className="relative grid gap-4">
                <div className="absolute bottom-0 left-4 top-0 w-px bg-gradient-to-b from-red-500 via-amber-400 to-zinc-800" />

                {person.timelineEvents.map((event) => (
                  <div key={event.id} className="relative pl-10">
                    <div className="absolute left-[9px] top-5 h-3 w-3 rounded-full bg-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.8)]" />
                    <div className="rounded-[1.35rem] border border-zinc-800 bg-black/45 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-amber-300">
                          {event.dateLabel}
                        </div>
                        <Badge tone="zinc">{event.category}</Badge>
                      </div>

                      <h3 className="mt-4 text-xl font-semibold text-white">
                        {event.title}
                      </h3>

                      <p className="mt-4 text-sm leading-7 text-zinc-300">
                        {event.summary}
                      </p>

                      <div className="mt-4 text-xs uppercase tracking-[0.24em] text-zinc-500">
                        Confidence: {event.confidence}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </section>

      <section className="py-8">
        <div className="mx-auto grid max-w-[1700px] gap-5 px-4 sm:px-6 xl:grid-cols-[1fr_0.85fr] lg:px-8">
          <Panel
            eyebrow="Internal Notes"
            title="Investigator remarks"
            text="Internal bureau comments, warnings, contradictions, sealed items, and follow-up recommendations."
          >
            <p className="whitespace-pre-line text-base leading-8 text-zinc-300">
              {person.internalNotes || "No internal notes available."}
            </p>
          </Panel>

          <Panel
            eyebrow="Unresolved Flags"
            title="Follow-up required"
            text="Analyst flags and uncertainty markers attached to the subject dossier."
          >
            {person.analystNotes.length === 0 ? (
              <EmptyState
                title="No analyst flags indexed"
                text="No unresolved flags or follow-up notes are currently attached to this subject file."
              />
            ) : (
              <div className="grid gap-4">
                {person.analystNotes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-[1.35rem] border border-red-500/20 bg-red-500/5 p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-red-200">
                        {note.category}
                      </div>
                      <Badge tone={note.severity === "HIGH" ? "red" : "amber"}>
                        {note.severity}
                      </Badge>
                    </div>

                    <h3 className="mt-4 text-xl font-semibold text-white">
                      {note.title}
                    </h3>

                    <p className="mt-4 text-sm leading-7 text-zinc-300">
                      {note.content}
                    </p>

                    <div className="mt-4 text-xs uppercase tracking-[0.24em] text-zinc-500">
                      Visibility: {note.visibility}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </section>
    </main>
  );
}

function Backdrop() {
  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(185,28,28,0.24),transparent_30%),radial-gradient(circle_at_85%_5%,rgba(14,116,144,0.16),transparent_28%),linear-gradient(to_bottom,#050507,#09090b_62%,#030304)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:54px_54px] opacity-25" />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(to_bottom,rgba(255,255,255,0.035)_0px,rgba(255,255,255,0.035)_1px,transparent_1px,transparent_5px)] opacity-[0.04]" />
    </>
  );
}

function BackdropSoft() {
  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(245,158,11,0.08),transparent_30%),radial-gradient(circle_at_80%_40%,rgba(14,116,144,0.08),transparent_28%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:54px_54px] opacity-20" />
    </>
  );
}

function getApproximateAge(dateOfBirth: string | null) {
  if (!dateOfBirth) return "Unknown";

  const date = new Date(dateOfBirth);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
    age -= 1;
  }

  return `${age}`;
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
  children: ReactNode;
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

function DossierBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-zinc-800 bg-black/45 p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-500">
        {label}
      </div>
      <p className="mt-4 text-sm leading-7 text-zinc-300">
        {value || "No indexed detail."}
      </p>
    </div>
  );
}

function LargeReadout({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "amber" | "red" | "cyan";
}) {
  const color =
    tone === "red"
      ? "border-red-500/20 bg-red-500/5 text-red-200"
      : tone === "cyan"
        ? "border-cyan-500/20 bg-cyan-500/5 text-cyan-200"
        : "border-amber-500/20 bg-amber-500/5 text-amber-200";

  return (
    <div className={`rounded-[1.35rem] border p-5 ${color}`}>
      <div className="font-mono text-[10px] uppercase tracking-[0.28em]">
        {label}
      </div>
      <p className="mt-4 text-sm leading-7 text-zinc-200">
        {value || "No indexed assessment."}
      </p>
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

function SystemBadge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "red" | "amber" | "cyan";
}) {
  const className =
    tone === "red"
      ? "border-red-500/30 bg-red-500/10 text-red-200"
      : tone === "cyan"
        ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
        : "border-amber-500/30 bg-amber-500/10 text-amber-200";

  return (
    <span
      className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.24em] ${className}`}
    >
      {children}
    </span>
  );
}

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "red" | "amber" | "cyan" | "zinc";
}) {
  const className =
    tone === "red"
      ? "border-red-500/30 bg-red-500/10 text-red-200"
      : tone === "cyan"
        ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
        : tone === "amber"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
          : "border-zinc-700 bg-zinc-950 text-zinc-300";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs ${className}`}>
      {children}
    </span>
  );
}