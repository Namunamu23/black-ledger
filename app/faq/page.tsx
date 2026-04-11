import SectionHeader from "@/components/ui/SectionHeader";
import { siteConfig } from "@/data/site";

export default function FAQPage() {
  return (
    <main className="bg-zinc-950 text-white">
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-6">
          <SectionHeader
            eyebrow="FAQ"
            title="Common questions"
            text="Clear answers reduce friction, improve trust, and make the product easier to understand before purchase."
          />

          <div className="mt-10 space-y-4">
            {siteConfig.faq.map((item) => (
              <div
                key={item.question}
                className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6"
              >
                <h2 className="text-xl font-semibold text-white">
                  {item.question}
                </h2>
                <p className="mt-4 text-sm leading-8 text-zinc-300">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}