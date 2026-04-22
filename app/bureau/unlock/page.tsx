import SectionHeader from "@/components/ui/SectionHeader";
import Reveal from "@/components/ui/Reveal";
import UnlockForm from "./_components/UnlockForm";

type PageProps = {
  searchParams: Promise<{ code?: string }>;
};

export default async function UnlockPage({ searchParams }: PageProps) {
  const { code } = await searchParams;

  return (
    <main className="bg-zinc-950 text-white">
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-6">
          <Reveal>
            <SectionHeader
              eyebrow="Bureau"
              title="Unlock evidence"
              text="Scan or type the code printed on a physical artifact to reveal its hidden case file."
            />
          </Reveal>

          <Reveal delay={0.05}>
            <div className="mt-10">
              <UnlockForm initialCode={code} />
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
