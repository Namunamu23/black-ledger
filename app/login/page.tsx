import { Suspense } from "react";
import Link from "next/link";
import PageHero from "@/components/ui/PageHero";
import LoginForm from "@/components/auth/LoginForm";
import { redirectIfAuthenticated } from "@/lib/auth-helpers";
import { BUREAU_MESSAGES } from "@/data/bureau-messages";

type SearchParams = Promise<{ callbackUrl?: string | string[] }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const callbackUrl =
    typeof params.callbackUrl === "string" ? params.callbackUrl : null;
  await redirectIfAuthenticated(callbackUrl);

  return (
    <main className="bg-zinc-950 text-white">
      <section className="py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <PageHero
            eyebrow="Login"
            title="Access the bureau"
            text="Use your account credentials to open protected bureau routes and access the digital review layer."
          >
            <div className="flex flex-wrap gap-4">
              <Link
                href="/cases"
                className="inline-flex items-center rounded-2xl border border-zinc-700 px-6 py-3 font-semibold text-white transition hover:bg-zinc-900"
              >
                Browse Cases
              </Link>
            </div>
          </PageHero>

          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              {BUREAU_MESSAGES.auth.signInEyebrow}
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-white">
              {BUREAU_MESSAGES.auth.signInHeading}
            </h2>
            <p className="mt-4 text-sm leading-7 text-zinc-300">
              {BUREAU_MESSAGES.auth.signInBody}
            </p>

            {/* Suspense boundary required because LoginForm reads
                useSearchParams (callbackUrl) — without it, Next would
                deopt the entire route to client-side rendering. */}
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </section>
    </main>
  );
}