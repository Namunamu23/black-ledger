import { prisma } from "@/lib/prisma";
import SectionHeader from "@/components/ui/SectionHeader";
import Reveal from "@/components/ui/Reveal";
import CreateCaseForm from "@/components/admin/CreateCaseForm";
import GenerateActivationCodeButton from "@/components/admin/GenerateActivationCodeButton";
import ToggleCaseStatusButton from "@/components/admin/ToggleCaseStatusButton";

export default async function AdminCasesPage() {
  const cases = await prisma.caseFile.findMany({
    include: {
      activationCodes: true,
      owners: true,
      theorySubmissions: true,
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
              {cases.map((caseFile, index) => (
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
                          <span>{caseFile.activationCodes.length} activation codes</span>
                          <span>{caseFile.owners.length} owners</span>
                          <span>{caseFile.theorySubmissions.length} submissions</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3 lg:justify-end">
                        <GenerateActivationCodeButton caseId={caseFile.id} />
                        <ToggleCaseStatusButton
                          caseId={caseFile.id}
                          isActive={caseFile.isActive}
                        />
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}