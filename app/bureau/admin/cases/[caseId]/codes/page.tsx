import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SectionHeader from "@/components/ui/SectionHeader";
import Reveal from "@/components/ui/Reveal";
import GenerateCodesForm from "./_components/GenerateCodesForm";
import RevokeButton from "./_components/RevokeButton";
import ExportCsvButton from "./_components/ExportCsvButton";

type PageProps = {
  params: Promise<{ caseId: string }>;
};

export default async function AdminCaseCodesPage({ params }: PageProps) {
  const { caseId } = await params;
  const parsedCaseId = Number(caseId);
  if (!Number.isInteger(parsedCaseId)) {
    notFound();
  }

  const caseFile = await prisma.caseFile.findUnique({
    where: { id: parsedCaseId },
    select: { id: true, title: true, slug: true },
  });
  if (!caseFile) {
    notFound();
  }

  const codes = await prisma.activationCode.findMany({
    where: { caseFileId: parsedCaseId },
    include: { claimedByUser: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
  });

  const total = codes.length;
  const claimed = codes.filter((c) => c.claimedAt !== null).length;
  const revoked = codes.filter((c) => c.revokedAt !== null).length;
  const unclaimed = total - claimed - revoked;

  return (
    <main className="bg-zinc-950 text-white">
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <SectionHeader
              eyebrow="Admin"
              title={`Codes — ${caseFile.title}`}
              text={`${total} codes total — ${claimed} claimed, ${unclaimed} unclaimed, ${revoked} revoked.`}
            />
          </Reveal>

          <Reveal delay={0.05}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/bureau/admin/cases"
                className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-950"
              >
                Back to cases
              </Link>
              <ExportCsvButton caseId={caseFile.id} />
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="mt-8">
              <GenerateCodesForm caseId={caseFile.id} />
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="mt-8 overflow-x-auto rounded-[2rem] border border-zinc-800 bg-zinc-900">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-800 text-xs uppercase tracking-[0.2em] text-zinc-500">
                  <tr>
                    <th className="px-6 py-4">Code</th>
                    <th className="px-6 py-4">Claimed By</th>
                    <th className="px-6 py-4">Claimed At</th>
                    <th className="px-6 py-4">Kit Serial</th>
                    <th className="px-6 py-4">Revoked</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-8 text-center text-zinc-500"
                      >
                        No activation codes yet for this case.
                      </td>
                    </tr>
                  ) : (
                    codes.map((c) => (
                      <tr
                        key={c.id}
                        className="border-b border-zinc-800/60 last:border-b-0"
                      >
                        <td className="px-6 py-4 font-mono text-zinc-100">
                          {c.code}
                        </td>
                        <td className="px-6 py-4 text-zinc-300">
                          {c.claimedByUser?.email ?? "—"}
                        </td>
                        <td className="px-6 py-4 text-zinc-400">
                          {c.claimedAt
                            ? c.claimedAt.toISOString().slice(0, 10)
                            : "—"}
                        </td>
                        <td className="px-6 py-4 text-zinc-300">
                          {c.kitSerial ?? "—"}
                        </td>
                        <td className="px-6 py-4">
                          {c.revokedAt ? (
                            <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400">
                              Revoked
                            </span>
                          ) : (
                            <span className="text-zinc-500">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {c.revokedAt === null ? (
                            <RevokeButton
                              caseId={caseFile.id}
                              codeId={c.id}
                              code={c.code}
                            />
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
