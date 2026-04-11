import Link from "next/link";
import { auth } from "@/auth";
import SectionHeader from "@/components/ui/SectionHeader";
import Reveal from "@/components/ui/Reveal";
import SignOutButton from "@/components/auth/SignOutButton";
import { siteConfig } from "@/data/site";

export default async function BureauPage() {
  const session = await auth();
  const userEmail = session?.user?.email ?? "Unknown user";
  const userRole =
    (session?.user as { role?: string } | undefined)?.role ?? "INVESTIGATOR";

  return (
    <main className="bg-zinc-950 text-white">
      <section className="relative overflow-hidden border-b border-zinc-900 py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),transparent_30%)]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <Reveal>
            <SectionHeader
              eyebrow="Bureau"
              title="Protected review access"
              text="This area now requires authentication. It is the foundation for future case activation, account-specific file access, and protected review tools."
            />
          </Reveal>

          <Reveal delay={0.08}>
            <div className="mt-10 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div>
                  <div className="text-sm text-zinc-400">Signed in as</div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {userEmail}
                  </div>
                  <div className="mt-2 text-sm uppercase tracking-[0.2em] text-amber-300">
                    {userRole}
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 lg:justify-end">
                  <Link
                    href={siteConfig.featuredCase.href}
                    className="inline-flex items-center rounded-2xl bg-white px-6 py-3 font-semibold text-zinc-950 transition hover:bg-zinc-200"
                  >
                    View Case 001
                  </Link>
                  <SignOutButton />
                </div>
              </div>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {siteConfig.portal.modules.map((module, index) => (
              <Reveal key={module.title} delay={index * 0.06}>
                <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
                  <h2 className="text-xl font-semibold text-white">{module.title}</h2>
                  <p className="mt-4 text-sm leading-7 text-zinc-300">
                    {module.text}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}