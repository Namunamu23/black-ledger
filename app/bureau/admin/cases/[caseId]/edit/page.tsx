import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import SectionHeader from "@/components/ui/SectionHeader";
import Reveal from "@/components/ui/Reveal";
import EditCaseContentForm from "@/components/admin/EditCaseContentForm";

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

  return (
    <main className="bg-zinc-950 text-white">
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <SectionHeader
              eyebrow="Admin"
              title={`Edit: ${caseFile.title}`}
              text="This editor manages full case content, progression data, solutions, and debrief content."
            />
          </Reveal>

          <Reveal delay={0.05}>
            <div className="mt-10">
              <EditCaseContentForm
                caseId={caseFile.id}
                initialData={{
                  title: caseFile.title,
                  slug: caseFile.slug,
                  summary: caseFile.summary,
                  players: caseFile.players,
                  duration: caseFile.duration,
                  difficulty: caseFile.difficulty,
                  maxStage: caseFile.maxStage,
                  solutionSuspect: caseFile.solutionSuspect,
                  solutionMotive: caseFile.solutionMotive,
                  solutionEvidence: caseFile.solutionEvidence,
                  debriefOverview: caseFile.debriefOverview,
                  debriefWhatHappened: caseFile.debriefWhatHappened,
                  debriefWhyItWorked: caseFile.debriefWhyItWorked,
                  debriefClosing: caseFile.debriefClosing,
                  debriefSectionTitle: caseFile.debriefSectionTitle,
                  debriefIntro: caseFile.debriefIntro,
                  isActive: caseFile.isActive,
                  people: caseFile.people.map((item) => ({
                    id: item.id,
                    globalPersonId: item.globalPersonId,
                    name: item.name,
                    role: item.role,
                    summary: item.summary,
                    unlockStage: item.unlockStage,
                    sortOrder: item.sortOrder,
                  })),
                  records: caseFile.records.map((item) => ({
                    id: item.id,
                    title: item.title,
                    category: item.category,
                    summary: item.summary,
                    body: item.body,
                    unlockStage: item.unlockStage,
                    sortOrder: item.sortOrder,
                  })),
                  hints: caseFile.hints.map((item) => ({
                    id: item.id,
                    level: item.level,
                    title: item.title,
                    content: item.content,
                    unlockStage: item.unlockStage,
                    sortOrder: item.sortOrder,
                  })),
                  checkpoints: caseFile.checkpoints.map((item) => ({
                    id: item.id,
                    stage: item.stage,
                    prompt: item.prompt,
                    acceptedAnswers: item.acceptedAnswers,
                    successMessage: item.successMessage,
                  })),
                }}
              />
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}