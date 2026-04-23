"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { siteConfig } from "@/data/site";
import WaitlistForm from "@/components/forms/WaitlistForm";

const EASE = [0.16, 1, 0.3, 1] as const;

const FILM_GRAIN_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")";

export default function HomePage() {
  const { home, featuredCase } = siteConfig;

  return (
    <div className="bg-[#080808] text-[#edeae4]">
      {/* ============================================================ */}
      {/* SECTION 1 — HERO                                              */}
      {/* ============================================================ */}
      <section className="relative min-h-screen overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 opacity-[0.022]"
          style={{ backgroundImage: FILM_GRAIN_SVG }}
        />

        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(circle,rgba(201,168,76,0.06),transparent_70%)]"
        />

        {/* Top bar */}
        <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between border-b border-[rgba(255,255,255,0.07)] px-8 py-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.4em] text-[rgba(237,234,228,0.3)]">
            BL-001 / ACTIVE INVESTIGATION
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.4em] text-[rgba(237,234,228,0.3)]">
            EST. MMXXV
            <motion.span
              aria-hidden
              animate={{ opacity: [1, 0, 1] }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="ml-1.5 inline-block text-[#c9a84c]"
            >
              ▍
            </motion.span>
          </span>
        </div>

        {/* Hero content */}
        <div className="relative flex min-h-screen flex-col justify-center px-8 pt-20 md:px-16 lg:px-24">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
            className="font-mono text-[11px] uppercase tracking-[0.45em] text-[#c9a84c]"
          >
            Black Ledger
          </motion.div>

          <div className="mt-6">
            <motion.div
              initial={{ clipPath: "inset(0 100% 0 0)", opacity: 0 }}
              animate={{ clipPath: "inset(0 0% 0 0)", opacity: 1 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.35 }}
              className="text-[clamp(3rem,7vw,7rem)] font-semibold leading-none tracking-tight text-[#edeae4]"
            >
              Open the file.
            </motion.div>
            <motion.div
              initial={{ clipPath: "inset(0 100% 0 0)", opacity: 0 }}
              animate={{ clipPath: "inset(0 0% 0 0)", opacity: 1 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.5 }}
              className="text-[clamp(3rem,7vw,7rem)] font-semibold leading-none tracking-tight text-[rgba(237,234,228,0.6)]"
            >
              Enter the bureau.
            </motion.div>
            <motion.div
              initial={{ clipPath: "inset(0 100% 0 0)", opacity: 0 }}
              animate={{ clipPath: "inset(0 0% 0 0)", opacity: 1 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.65 }}
              className="text-[clamp(3rem,7vw,7rem)] font-semibold leading-none tracking-tight"
            >
              <span className="text-[rgba(237,234,228,0.35)]">Solve what </span>
              <span className="text-[#edeae4]">they missed.</span>
            </motion.div>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.9 }}
            className="mt-8 max-w-md text-[15px] leading-7 text-[rgba(237,234,228,0.5)]"
          >
            {home.heroText}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 1.1 }}
            className="mt-8 flex items-center gap-6"
          >
            <Link
              href={featuredCase.href}
              className="inline-flex items-center gap-2 rounded-full bg-[#c9a84c] px-6 py-3 text-sm font-semibold text-[#080808] transition hover:bg-[#d4b55a]"
            >
              Examine Case 001
              <ArrowRight size={14} strokeWidth={2.25} />
            </Link>
            <Link
              href="/cases"
              className="text-[14px] text-[rgba(237,234,228,0.5)] underline decoration-[rgba(237,234,228,0.2)] underline-offset-4 transition hover:text-[#edeae4]"
            >
              View all cases
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.0, ease: EASE, delay: 0.5 }}
            className="absolute right-8 top-1/2 hidden w-72 -translate-y-1/2 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] p-5 backdrop-blur-sm transition hover:border-[rgba(255,255,255,0.12)] lg:block lg:right-16"
          >
            <div className="flex items-start justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[rgba(237,234,228,0.3)]">
                Case File
              </span>
              <span
                aria-hidden
                className="h-2 w-2 animate-pulse rounded-full bg-[#c9a84c]"
              />
            </div>
            <div className="mt-3 text-[15px] font-semibold text-[#edeae4]">
              {featuredCase.title}
            </div>
            <div className="mt-1 font-mono text-[11px] text-[rgba(237,234,228,0.3)]">
              BL-{featuredCase.id} / {featuredCase.difficulty}
            </div>
            <div className="mt-4 border-t border-[rgba(255,255,255,0.07)]" />
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <CardStat value={featuredCase.players} label="Players" />
              <CardStat value={featuredCase.duration} label="Duration" />
              <CardStat value={featuredCase.difficulty} label="Tier" />
            </div>
          </motion.div>

          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{
              duration: 2.4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute bottom-8 left-8 flex items-center gap-3"
          >
            <div className="h-8 w-px bg-gradient-to-b from-[rgba(237,234,228,0.3)] to-transparent" />
            <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-[rgba(237,234,228,0.2)]">
              Scroll
            </span>
          </motion.div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 2 — HAIRLINE + THREE NUMBERS                          */}
      {/* ============================================================ */}
      <section className="relative border-t border-[rgba(255,255,255,0.07)] bg-[#080808]">
        <motion.div
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 1.2, ease: EASE }}
          style={{ originX: 0 }}
          className="absolute left-0 top-0 h-px w-full bg-[#c9a84c]/30"
          aria-hidden
        />
        <div className="grid grid-cols-3 divide-x divide-[rgba(255,255,255,0.07)] px-8 py-16 md:px-16 lg:px-24">
          <BigStat number="01" label="Physical Evidence Kit" delay={0} />
          <BigStat number="03" label="Investigation Stages" delay={0.1} />
          <BigStat number="90+" label="Minutes of Investigation" delay={0.2} />
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 3 — EDITORIAL "WHAT IT IS"                            */}
      {/* ============================================================ */}
      <section className="border-t border-[rgba(255,255,255,0.07)] px-8 py-24 md:px-16 lg:px-24">
        <div className="grid gap-16 lg:grid-cols-[1fr_1fr]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.8, ease: EASE }}
            className="lg:sticky lg:top-32 lg:self-start"
          >
            <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-[rgba(237,234,228,0.35)]">
              Why It Feels Different
            </div>
            <p className="mt-6 text-[clamp(1.6rem,3vw,2.4rem)] font-semibold leading-tight text-[#edeae4]">
              Built to feel more deliberate than a standard mystery box.
            </p>
            <p className="mt-6 text-[15px] leading-7 text-[rgba(237,234,228,0.5)]">
              Not random complexity. Not puzzle mechanics for their own sake.
              A premium case file with real structure, staged evidence, and a
              serious review layer.
            </p>
          </motion.div>

          <div className="space-y-8">
            {home.differentiators.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: 16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{
                  duration: 0.7,
                  ease: EASE,
                  delay: index * 0.1,
                }}
                className="border-t border-[rgba(255,255,255,0.07)] pt-8"
              >
                <h3 className="text-[17px] font-semibold text-[#edeae4]">
                  {item.title}
                </h3>
                <p className="mt-3 text-[14px] leading-7 text-[rgba(237,234,228,0.45)]">
                  {item.text}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 4 — HOW IT WORKS                                      */}
      {/* ============================================================ */}
      <section className="border-t border-[rgba(255,255,255,0.07)] px-8 py-24 md:px-16 lg:px-24">
        <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-[rgba(237,234,228,0.35)]">
          Process
        </div>
        <h2 className="mt-4 text-[clamp(1.8rem,3vw,2.5rem)] font-semibold text-[#edeae4]">
          Three steps. One investigation.
        </h2>

        <div className="mt-12 grid gap-12 lg:grid-cols-3 lg:gap-0">
          {home.howSteps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{
                duration: 0.7,
                ease: EASE,
                delay: index * 0.12,
              }}
              className="relative lg:px-8"
            >
              <div className="font-mono text-[11px] text-[#c9a84c]">
                0{index + 1}
              </div>
              <h3 className="mt-4 text-[17px] font-semibold text-[#edeae4]">
                {step.title}
              </h3>
              <p className="mt-3 text-[14px] leading-7 text-[rgba(237,234,228,0.45)]">
                {step.text}
              </p>
              {index < home.howSteps.length - 1 ? (
                <div
                  aria-hidden
                  className="absolute right-0 top-6 hidden h-8 w-px bg-[rgba(255,255,255,0.07)] lg:block"
                />
              ) : null}
            </motion.div>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 5 — FEATURED CASE                                     */}
      {/* ============================================================ */}
      <section className="border-t border-[rgba(255,255,255,0.07)] px-8 py-24 md:px-16 lg:px-24">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="grid items-center gap-12 lg:grid-cols-[1fr_0.7fr]"
        >
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-[rgba(237,234,228,0.35)]">
              Featured File
            </div>
            <h2 className="mt-4 text-[clamp(1.8rem,3vw,2.5rem)] font-semibold text-[#edeae4]">
              {featuredCase.title}
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-[rgba(237,234,228,0.5)]">
              {featuredCase.summary}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <CasePill label={featuredCase.players} />
              <CasePill label={featuredCase.duration} />
              <CasePill label={featuredCase.difficulty} />
            </div>
            <Link
              href={featuredCase.href}
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.15)] px-5 py-2.5 text-sm text-[#edeae4] transition hover:border-[#c9a84c] hover:text-[#c9a84c]"
            >
              Open Case File
              <ArrowRight size={14} strokeWidth={2.25} />
            </Link>
          </div>

          <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] p-6">
            <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.3em] text-[rgba(237,234,228,0.25)]">
              <span>Investigation File</span>
              <span>BL-{featuredCase.id}</span>
            </div>
            <div className="mt-3 border-t border-[rgba(255,255,255,0.07)]" />
            <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-[rgba(237,234,228,0.25)]">
              CASE ID: BL-001-ALDER
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span
                aria-hidden
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#c9a84c]"
              />
              <span className="text-[13px] text-[rgba(237,234,228,0.5)]">
                Active — Accepting Investigators
              </span>
            </div>
            <div className="mt-4 space-y-2">
              <FileStat label="Operatives" value={featuredCase.players} />
              <FileStat label="Duration" value={featuredCase.duration} />
              <FileStat label="Tier" value={featuredCase.difficulty} />
            </div>
          </div>
        </motion.div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 6 — WAITLIST                                          */}
      {/* ============================================================ */}
      <section className="border-t border-[rgba(255,255,255,0.07)] px-8 py-24 md:px-16 lg:px-24">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="max-w-lg"
        >
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-[rgba(237,234,228,0.35)]">
            Stay Informed
          </div>
          <h2 className="mt-4 text-[clamp(1.5rem,2.5vw,2rem)] font-semibold text-[#edeae4]">
            Get updates on new case releases and bureau announcements.
          </h2>
          <p className="mt-3 text-[14px] text-[rgba(237,234,228,0.45)]">
            No spam. Case release announcements and bureau updates only.
          </p>
          <div className="mt-6">
            <WaitlistForm />
          </div>
        </motion.div>
      </section>
    </div>
  );
}

// ---- Small subcomponents ----

function CardStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-[18px] font-semibold tabular-nums text-[#edeae4]">
        {value}
      </div>
      <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.25em] text-[rgba(237,234,228,0.3)]">
        {label}
      </div>
    </div>
  );
}

function BigStat({
  number,
  label,
  delay,
}: {
  number: string;
  label: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.7, ease: EASE, delay }}
      className="px-8 text-center"
    >
      <div className="text-[clamp(3rem,6vw,5rem)] font-black tabular-nums text-[#edeae4]">
        {number}
      </div>
      <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.35em] text-[rgba(237,234,228,0.35)]">
        {label}
      </div>
    </motion.div>
  );
}

function CasePill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-[rgba(255,255,255,0.1)] px-3 py-1 font-mono text-[11px] tracking-[0.2em] text-[rgba(237,234,228,0.45)]">
      {label}
    </span>
  );
}

function FileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-t border-[rgba(255,255,255,0.05)] pt-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[rgba(237,234,228,0.3)]">
        {label}
      </span>
      <span className="font-mono text-[11px] text-[rgba(237,234,228,0.6)]">
        {value}
      </span>
    </div>
  );
}
