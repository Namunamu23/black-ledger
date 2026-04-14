import { prisma } from "@/lib/prisma";
import SectionHeader from "@/components/ui/SectionHeader";
import Reveal from "@/components/ui/Reveal";
import CreateCaseForm from "@/components/admin/CreateCaseForm";
import GenerateActivationCodeButton from "@/components/admin/GenerateActivationCodeButton";
import ToggleCaseStatusButton from "@/components/admin/ToggleCaseStatusButton";
import PublishCaseButton from "@/components/admin/PublishCaseButton";
import { evaluateCaseReadiness } from "@/lib/case-quality";

export default async function AdminCasesPage() {
  const cases = await prisma.caseFile.findMany({
    include: {
      activationCodes: true,
      owners: true,
      theorySubmissions: true,
      people: true,
      records: true,
      hints: true,
      checkpoints: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="bg-zinc-950 text-white">
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <SectionHeader
              eyebrow="Admin"
              title="Case management"
              text="Internal tools for creating case shells, generating activation codes, and managing catalog availability."
            />
          </Reveal>

          <Reveal delay={0.05}>
            <div className="mt-10 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Create case shell
              </div>
              <h2 className="mt-4 text-3xl font-semibold text-white">
                New case
              </h2>

              <div className="mt-8">
                <CreateCaseForm />
              </div>
            </div>
          </Reveal>

          <div className="mt-12">
            <Reveal>
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Existing cases
              </div>
              <h2 className="mt-4 text-3xl font-semibold text-white">
                Catalog management
              </h2>
            </Reveal>

            <div className="mt-6 grid gap-4">
              {cases.map((caseFile, index) => {
                const readiness = evaluateCaseReadiness(caseFile);

                return (
                  <Reveal key={caseFile.id} delay={index * 0.04}>
                    <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
                      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                        <div className="max-w-3xl">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                              {caseFile.slug}
                            </div>
                            <span
                              className={`rounded-full border px-3 py-1 text-xs ${
                                caseFile.isActive
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                  : "border-zinc-700 bg-zinc-950 text-zinc-400"
                              }`}
                            >
                              {caseFile.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>

                          <h3 className="mt-4 text-2xl font-semibold text-white">
                            {caseFile.title}
                          </h3>

                          <p className="mt-4 text-sm leading-7 text-zinc-300">
                            {caseFile.summary}
                          </p>

                          <div className="mt-6 flex flex-wrap gap-4 text-sm text-zinc-400">
                            <span>
                              {caseFile.activationCodes.length} activation codes
                            </span>
                            <span>{caseFile.owners.length} owners</span>
                            <span>
                              {caseFile.theorySubmissions.length} submissions
                            </span>
                          </div>

                          <div className="mt-4">
                            <span
                              className={`rounded-full border px-3 py-1 text-xs ${
                                caseFile.workflowStatus === "PUBLISHED"
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                              }`}
                            >
                              {caseFile.workflowStatus}
                            </span>

                            <div className="mt-3 text-sm text-zinc-400">
                              {readiness.isReady
                                ? "Ready to publish."
                                : `Needs work: ${readiness.issues.join(" ")}`}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3 lg:justify-end">
  <a
    href={`/bureau/admin/cases/${caseFile.id}/edit`}
    className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-950"
  >
    Edit Content
  </a>

  <a
    href={`/bureau/admin/cases/${caseFile.id}/preview`}
    className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-950"
  >
    Preview
  </a>

  <PublishCaseButton
    caseId={caseFile.id}
    workflowStatus={caseFile.workflowStatus}
  />

  <GenerateActivationCodeButton caseId={caseFile.id} />

  <ToggleCaseStatusButton
    caseId={caseFile.id}
    isActive={caseFile.isActive}
  />
</div>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}