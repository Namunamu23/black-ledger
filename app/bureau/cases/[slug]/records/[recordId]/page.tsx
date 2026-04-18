import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Reveal from "@/components/ui/Reveal";

type PageProps = {
  params: Promise<{
    slug: string;
    recordId: string;
  }>;
};

export default async function CaseRecordDetailPage({ params }: PageProps) {
  const { slug, recordId } = await params;

  const parsedRecordId = Number(recordId);

  if (!Number.isInteger(parsedRecordId)) {
    notFound();
  }

  const session = await auth();
  const userId = Number((session?.user as { id?: string } | undefined)?.id);

  if (!Number.isInteger(userId)) {
    notFound();
  }

  const ownedCase = await prisma.userCase.findFirst({
    where: {
      userId,
      caseFile: { slug },
    },
    include: {
      caseFile: true,
    },
  });

  if (!ownedCase) {
    notFound();
  }

  const record = await prisma.caseRecord.findFirst({
    where: {
      id: parsedRecordId,
      caseFileId: ownedCase.caseFileId,
      unlockStage: {
        lte: ownedCase.currentStage,
      },
    },
  });

  if (!record) {
    notFound();
  }

  return (
    <main className="bg-zinc-950 text-white">
      <section className="border-b border-zinc-900 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal>
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              Evidence Record
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {record.title}
            </h1>

            <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-300">
              {record.summary}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
                {record.category}
              </span>

              <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
                Unlock Stage {record.unlockStage}
              </span>
            </div>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href={`/bureau/cases/${slug}/database`}
                className="rounded-2xl bg-white px-5 py-3 font-semibold text-zinc-950 transition hover:bg-zinc-200"
              >
                Back to Database
              </Link>

              <Link
                href={`/bureau/cases/${slug}`}
                className="rounded-2xl border border-zinc-700 px-5 py-3 font-semibold text-white transition hover:bg-zinc-900"
              >
                Workspace
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal>
            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Record Body
              </div>

              <p className="mt-5 whitespace-pre-line text-base leading-8 text-zinc-300">
                {record.body}
              </p>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}