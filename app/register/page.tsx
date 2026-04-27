import { Suspense } from "react";
import Link from "next/link";
import PageHero from "@/components/ui/PageHero";
import RegisterForm from "@/components/auth/RegisterForm";

export const metadata = {
  title: "Create Account",
};

export default function RegisterPage() {
  return (
    <main className="bg-zinc-950 text-white">
      <section className="py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <PageHero
            eyebrow="Register"
            title="Create your operative account"
            text="A free account gives you access to the bureau — the digital review layer where you work through your case files, search records, and submit your final theory."
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
              New account
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-white">
              Sign up
            </h2>
            <p className="mt-4 text-sm leading-7 text-zinc-300">
              Already have a kit? You can activate your case code immediately
              after creating your account.
            </p>

            {/* Suspense boundary required — RegisterForm reads useSearchParams */}
            <Suspense fallback={null}>
              <RegisterForm />
            </Suspense>
          </div>
        </div>
      </section>
    </main>
  );
}
