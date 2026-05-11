import Link from "next/link";
import SectionHeader from "@/components/ui/SectionHeader";
import Reveal from "@/components/ui/Reveal";
import UnlockForm from "./_components/UnlockForm";
import { getOptionalSession } from "@/lib/auth-helpers";
import { BUREAU_MESSAGES } from "@/data/bureau-messages";

type PageProps = {
  searchParams: Promise<{ code?: string }>;
};

export default async function UnlockPage({ searchParams }: PageProps) {
  const { code } = await searchParams;
  const session = await getOptionalSession();

  if (!session) {
    // Preserve the QR code through the login bounce by stashing the
    // current path (with code if present) on the callbackUrl. NextAuth
    // returns to that URL after a successful sign-in, where the form
    // auto-submits via UnlockForm's initialCode effect.
    const loginHref = code
      ? `/login?callbackUrl=${encodeURIComponent(`/bureau/unlock?code=${code}`)}`
      : `/login?callbackUrl=${encodeURIComponent("/bureau/unlock")}`;

    return (
      <main className="bg-zinc-950 text-white">
        <section className="py-20">
          <div className="mx-auto max-w-3xl px-6">
            <Reveal>
              <SectionHeader
                eyebrow="Bureau"
                title={BUREAU_MESSAGES.unlock.pendingHeading}
                text="You need a Bureau account to redeem an access code. After signing in we'll bring you back to this page with your code pre-filled."
              />
            </Reveal>

            <Reveal delay={0.05}>
              <div className="mt-10 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
                <p className="text-sm leading-7 text-zinc-300">
                  {code
                    ? BUREAU_MESSAGES.unlock.pendingBodyWithCode(code)
                    : BUREAU_MESSAGES.unlock.pendingBodyWithoutCode}
                </p>
                <Link
                  href={loginHref}
                  className="mt-6 inline-flex items-center rounded-2xl bg-amber-400 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-amber-300"
                >
                  {BUREAU_MESSAGES.unlock.pendingCta}
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="bg-zinc-950 text-white">
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-6">
          <Reveal>
            <SectionHeader
              eyebrow={BUREAU_MESSAGES.unlock.activeEyebrow}
              title={BUREAU_MESSAGES.unlock.activeHeading}
              text={BUREAU_MESSAGES.unlock.activeBody}
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
