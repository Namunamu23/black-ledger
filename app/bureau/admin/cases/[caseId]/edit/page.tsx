import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import SectionHeader from "@/components/ui/SectionHeader";
import Reveal from "@/components/ui/Reveal";
import { Tabs } from "./_components/Tabs";
import OverviewTab from "./_components/OverviewTab";
import PeopleTab from "./_components/PeopleTab";
import RecordsTab from "./_components/RecordsTab";
import HintsTab from "./_components/HintsTab";
import CheckpointsTab from "./_components/CheckpointsTab";
import SolutionTab from "./_components/SolutionTab";

type PageProps = {
  params: Promise<{
    caseId: string;
  }>;
};

export default async function EditAdminCasePage({ params }: PageProps) {
  const { caseId } = await params;
  const parsedCaseId = Number(caseId);

  if (!Number.isInteger(parsedCaseId)) {
    notFound();
  }

  const caseFile = await prisma.caseFile.findUnique({
    where: { id: parsedCaseId },
    include: {
      people: { orderBy: { sortOrder: "asc" } },
      records: { orderBy: { sortOrder: "asc" } },
      hints: { orderBy: [{ unlockStage: "asc" }, { sortOrder: "asc" }] },
      checkpoints: { orderBy: { stage: "asc" } },
    },
  });

  if (!caseFile) {
    notFound();
  }

  const overviewSlice = {
    title: caseFile.title,
    slug: caseFile.slug,
    summary: caseFile.summary,
    players: caseFile.players,
    duration: caseFile.duration,
    difficulty: caseFile.difficulty,
    maxStage: caseFile.maxStage,
    isActive: caseFile.isActive,
    heroImageUrl: caseFile.heroImageUrl,
  };

  const peopleSlice = caseFile.people.map((p) => ({
    id: p.id,
    globalPersonId: p.globalPersonId,
    name: p.name,
    role: p.role,
    summary: p.summary,
    portraitUrl: p.portraitUrl,
    unlockStage: p.unlockStage,
    sortOrder: p.sortOrder,
  }));

  const recordsSlice = caseFile.records.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    summary: r.summary,
    body: r.body,
    unlockStage: r.unlockStage,
    sortOrder: r.sortOrder,
  }));

  const hintsSlice = caseFile.hints.map((h) => ({
    id: h.id,
    level: h.level,
    title: h.title,
    content: h.content,
    unlockStage: h.unlockStage,
    sortOrder: h.sortOrder,
  }));

  const checkpointsSlice = caseFile.checkpoints.map((c) => ({
    id: c.id,
    stage: c.stage,
    prompt: c.prompt,
    acceptedAnswers: c.acceptedAnswers,
    successMessage: c.successMessage,
  }));

  const solutionSlice = {
    solutionSuspect: caseFile.solutionSuspect,
    solutionMotive: caseFile.solutionMotive,
    solutionEvidence: caseFile.solutionEvidence,
    debriefOverview: caseFile.debriefOverview,
    debriefWhatHappened: caseFile.debriefWhatHappened,
    debriefWhyItWorked: caseFile.debriefWhyItWorked,
    debriefClosing: caseFile.debriefClosing,
    debriefSectionTitle: caseFile.debriefSectionTitle,
    debriefIntro: caseFile.debriefIntro,
  };

  return (
    <main className="bg-zinc-950 text-white">
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <SectionHeader
              eyebrow="Admin"
              title={`Edit: ${caseFile.title}`}
              text="Each tab saves independently. Changes in one tab do not affect drafts in another until that tab is saved."
            />
          </Reveal>

          <Reveal delay={0.05}>
            <div className="mt-10">
              <Tabs
                defaultValue="overview"
                tabs={[
                  {
                    value: "overview",
                    label: "Overview",
                    content: (
                      <OverviewTab
                        caseId={caseFile.id}
                        data={overviewSlice}
                      />
                    ),
                  },
                  {
                    value: "people",
                    label: "People",
                    content: (
                      <PeopleTab caseId={caseFile.id} data={peopleSlice} />
                    ),
                  },
                  {
                    value: "records",
                    label: "Records",
                    content: (
                      <RecordsTab caseId={caseFile.id} data={recordsSlice} />
                    ),
                  },
                  {
                    value: "hints",
                    label: "Hints",
                    content: (
                      <HintsTab caseId={caseFile.id} data={hintsSlice} />
                    ),
                  },
                  {
                    value: "checkpoints",
                    label: "Checkpoints",
                    content: (
                      <CheckpointsTab
                        caseId={caseFile.id}
                        data={checkpointsSlice}
                      />
                    ),
                  },
                  {
                    value: "solution",
                    label: "Solution",
                    content: (
                      <SolutionTab
                        caseId={caseFile.id}
                        data={solutionSlice}
                      />
                    ),
                  },
                ]}
              />
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
