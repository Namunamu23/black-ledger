import Link from "next/link";
import PageHero from "@/components/ui/PageHero";

export default function LoginPage() {
  return (
    <main className="bg-zinc-950 text-white">
      <section className="py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <PageHero
            eyebrow="Login"
            title="Access the bureau"
            text="Account access and protected case portal features will be connected in a later phase. This page is already structured to support that transition cleanly."
          >
            <div className="flex flex-wrap gap-4">
              <Link
                href="/bureau"
                className="inline-flex items-center rounded-2xl border border-zinc-700 px-6 py-3 font-semibold text-white transition hover:bg-zinc-900"
              >
                View Bureau Overview
              </Link>
            </div>
          </PageHero>

          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              Secure access
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-white">
              Sign in
            </h2>

            <div className="mt-8 grid gap-4">
              <input
                type="email"
                placeholder="Email"
                className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
              />
              <input
                type="password"
                placeholder="Password"
                className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
              />
              <button className="rounded-2xl bg-amber-400 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-amber-300">
                Log In
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}