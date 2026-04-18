import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import SectionHeader from "@/components/ui/SectionHeader";
import Reveal from "@/components/ui/Reveal";
import GlobalPeopleSearch from "@/components/bureau/GlobalPeopleSearch";

export default async function BureauGlobalDatabasePage() {
  const session = await auth();

  if (!session?.user) {
    notFound();
  }

  const people = await prisma.globalPerson.findMany({
    include: {
      aliases: true,
      caseAppearances: {
        include: {
          caseFile: true,
        },
      },
    },
    orderBy: {
      bureauId: "asc",
    },
  });

  return (
    <main className="bg-zinc-950 text-white">
      <section className="relative overflow-hidden border-b border-zinc-900 py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),transparent_35%)]" />

        <div className="relative mx-auto max-w-6xl px-6">
          <Reveal>
            <SectionHeader
              eyebrow="Bureau Intelligence"
              title="Global person database"
              text="Search the wider Black Ledger universe for subjects, witnesses, victims, suspects, aliases, associates, and unresolved profiles."
            />
          </Reveal>

          <Reveal delay={0.08}>
            <div className="mt-10">
              <GlobalPeopleSearch people={people} />
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}