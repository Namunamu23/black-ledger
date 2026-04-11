import SectionHeader from "@/components/ui/SectionHeader";
import { siteConfig } from "@/data/site";

export default function SupportPage() {
  return (
    <main className="bg-zinc-950 text-white">
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeader
            eyebrow="Support"
            title="Support and troubleshooting"
            text="This page should solve common issues clearly and quickly while keeping the brand feeling professional and trustworthy."
          />

          <div className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
              <h2 className="text-2xl font-semibold text-white">
                Common support topics
              </h2>
              <ul className="mt-6 space-y-3 text-sm leading-7 text-zinc-300">
                {siteConfig.supportTopics.map((topic) => (
                  <li key={topic}>{topic}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
              <h2 className="text-2xl font-semibold text-white">
                Contact support
              </h2>
              <p className="mt-4 text-sm leading-8 text-zinc-300">
                For now, this is a styled support form shell. Backend handling can be added later without redesigning the page.
              </p>

              <div className="mt-8 grid gap-4">
                <input
                  type="text"
                  placeholder="Your name"
                  className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
                />
                <input
                  type="email"
                  placeholder="Email address"
                  className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
                />
                <textarea
                  placeholder="How can we help?"
                  className="min-h-[140px] rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
                />
                <button className="rounded-2xl bg-white px-5 py-3 font-semibold text-zinc-950 transition hover:bg-zinc-200">
                  Send Message
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}