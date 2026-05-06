import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import SectionHeader from "@/components/ui/SectionHeader";
import Reveal from "@/components/ui/Reveal";
import AccessCodesPanel, {
  type AccessCodeWithCount,
} from "./_components/AccessCodesPanel";

type PageProps = {
  params: Promise<{ caseId: string }>;
};

export default async function AdminAccessCodesPage({ params }: PageProps) {
  const { caseId } = await params;
  const parsedCaseId = Number(caseId);
  if (!Number.isInteger(parsedCaseId)) {
    notFound();
  }

  const caseFile = await prisma.caseFile.findUnique({
    where: { id: parsedCaseId },
    include: {
      people: {
        select: { id: true, name: true },
        orderBy: { sortOrder: "asc" },
      },
      records: {
        select: { id: true, title: true },
        orderBy: { sortOrder: "asc" },
      },
      hints: {
        select: { id: true, title: true },
        orderBy: [{ unlockStage: "asc" }, { sortOrder: "asc" }],
      },
      // F-15: surface hidden_evidence rows so admins can target them from
      // the UI. The API + redeem route + workspace renderer already accept
      // hidden_evidence; this closes the UI gap.
      hiddenEvidence: {
        select: { id: true, title: true },
        orderBy: { revealOrder: "asc" },
      },
    },
  });
  if (!caseFile) {
    notFound();
  }

  const codes = await prisma.accessCode.findMany({
    where: { caseFileId: parsedCaseId },
    include: { redemptions: { select: { id: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Serialize Date → string so the shape matches whatever the GET endpoint
  // returns when the client refetches after a create.
  const initialCodes: AccessCodeWithCount[] = codes.map((c) => ({
    id: c.id,
    code: c.code,
    kind: c.kind,
    unlocksTarget: c.unlocksTarget,
    requiresStage: c.requiresStage,
    oneTimePerUser: c.oneTimePerUser,
    retiredAt: c.retiredAt ? c.retiredAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
    redemptions: c.redemptions,
  }));

  return (
    <main className="bg-zinc-950 text-white">
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <SectionHeader
              eyebrow="Admin"
              title={`Access Codes — ${caseFile.title}`}
              text="Create the short codes printed on physical artifacts (QR stickers, witness cards, audio tags) that unlock hidden in-game evidence when a player redeems them."
            />
          </Reveal>

          <Reveal delay={0.05}>
            <div className="mt-8">
              <Link
                href="/bureau/admin/cases"
                className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-950"
              >
                Back to cases
              </Link>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="mt-8">
              <AccessCodesPanel
                caseId={caseFile.id}
                people={caseFile.people}
                records={caseFile.records}
                hints={caseFile.hints}
                hiddenEvidence={caseFile.hiddenEvidence}
                initialCodes={initialCodes}
              />
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
