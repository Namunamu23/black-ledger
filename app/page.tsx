"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  motion,
  useInView,
  useScroll,
  useTransform,
} from "framer-motion";
import { ArrowRight } from "lucide-react";
import clsx from "clsx";
import { siteConfig } from "@/data/site";
import WaitlistForm from "@/components/forms/WaitlistForm";

const EASE = [0.16, 1, 0.3, 1] as const;

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`;

export default function HomePage() {
  const { home, featuredCase } = siteConfig;
  const { scrollYProgress } = useScroll();

  const heroRef = useRef<HTMLElement>(null);
  const heroInView = useInView(heroRef, { once: true, amount: 0.2 });

  const featuredRef = useRef<HTMLElement>(null);
  const { scrollYProgress: featuredScroll } = useScroll({
    target: featuredRef,
    offset: ["start end", "end start"],
  });
  const cardY = useTransform(featuredScroll, [0, 1], [-40, 40]);

  return (
    <div className="relative overflow-x-hidden">
      {/* Global: scroll progress bar */}
      <motion.div
        aria-hidden
        style={{ scaleX: scrollYProgress, transformOrigin: "left" }}
        className="fixed left-0 right-0 top-0 z-[200] h-[2px] bg-[#c9a84c]"
      />

      {/* Global: film grain */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[150] opacity-[0.025]"
        style={{ backgroundImage: GRAIN }}
      />

      {/* ============================================================ */}
      {/* SECTION 1 — HERO (#000000)                                    */}
      {/* ============================================================ */}
      <section
        ref={heroRef}
        className="relative min-h-screen overflow-hidden bg-[#000000]"
      >
        {/* Ambient glows */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(196,28,28,0.08),transparent_65%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 h-[400px] w-[600px] translate-x-1/3 translate-y-1/4 bg-[radial-gradient(circle,rgba(201,168,76,0.06),transparent_70%)]"
        />

        <div className="relative flex min-h-screen flex-col justify-center px-8 pb-16 pt-24 md:px-16 lg:px-24">
          {/* Headline — three lines, word-by-word reveal */}
          <div>
            <p className="text-[clamp(3.5rem,8vw,8.5rem)] font-black leading-[0.92] tracking-[-0.03em] text-[#f5f0eb]">
              <WordReveal
                text="Open the file."
                inView={heroInView}
                baseDelay={0.1}
              />
            </p>
            <p className="text-[clamp(3.5rem,8vw,8.5rem)] font-black leading-[0.92] tracking-[-0.03em] text-[rgba(245,240,235,0.38)]">
              <WordReveal
                text="Enter the bureau."
                inView={heroInView}
                baseDelay={0.25}
              />
            </p>
            <p className="text-[clamp(3.5rem,8vw,8.5rem)] font-black leading-[0.92] tracking-[-0.03em]">
              <span className="text-[rgba(245,240,235,0.2)]">
                <WordReveal
                  text="Solve what"
                  inView={heroInView}
                  baseDelay={0.4}
                />
              </span>
              <span className="text-[#f5f0eb]">
                {" "}
                <WordReveal
                  text="they missed."
                  inView={heroInView}
                  baseDelay={0.52}
                />
              </span>
            </p>
          </div>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 1.1 }}
            className="mt-10 max-w-sm text-[15px] leading-7 text-[rgba(245,240,235,0.45)]"
          >
            {home.heroText}
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 1.3 }}
            className="mt-8 flex items-center gap-8"
          >
            <MagneticLink
              href={featuredCase.href}
              className="group relative overflow-hidden rounded-full bg-[#c9a84c] px-8 py-3.5 text-[14px] font-semibold text-[#000] transition"
            >
              <span
                aria-hidden
                className="absolute inset-0 origin-left scale-x-0 bg-white/10 transition-transform duration-300 group-hover:scale-x-100"
              />
              <span className="relative z-10 flex items-center gap-2">
                Examine Case 001
                <ArrowRight size={14} strokeWidth={2.25} />
              </span>
            </MagneticLink>

            <a
              href="/cases"
              className="border-b border-[rgba(245,240,235,0.12)] pb-0.5 font-mono text-[13px] uppercase tracking-[0.3em] text-[rgba(245,240,235,0.35)] transition hover:border-[rgba(245,240,235,0.4)] hover:text-[rgba(245,240,235,0.7)]"
            >
              All Cases
            </a>
          </motion.div>

          {/* Floating case card (lg+ only) */}
          <div className="absolute right-8 top-1/2 hidden w-72 -translate-y-1/2 lg:block lg:right-16">
            <motion.div
              initial={{ opacity: 0, x: 40, rotate: 3 }}
              animate={{ opacity: 1, x: 0, rotate: 0 }}
              transition={{ duration: 1.2, ease: EASE, delay: 0.6 }}
              whileHover={{ y: -6, rotate: -0.5 }}
              className="rounded-2xl border border-[rgba(245,240,235,0.08)] bg-[rgba(245,240,235,0.03)] p-5"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] uppercase tracking-[0.4em] text-[rgba(245,240,235,0.2)]">
                  CASE FILE
                </span>
                <span
                  aria-hidden
                  className="h-2 w-2 animate-pulse rounded-full bg-[#c41c1c]"
                />
              </div>
              <div className="mt-4 text-[15px] font-semibold leading-tight text-[#f5f0eb]">
                {featuredCase.title}
              </div>
              <div className="mt-1.5 font-mono text-[10px] text-[rgba(245,240,235,0.25)]">
                BL-{featuredCase.id} · {featuredCase.difficulty}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-1 border-t border-[rgba(245,240,235,0.07)] pt-4 text-center">
                <FloatStat value={featuredCase.players} label="Players" />
                <FloatStat value={featuredCase.duration} label="Time" />
                <FloatStat value={featuredCase.difficulty} label="Tier" />
              </div>
            </motion.div>
          </div>

          {/* Scroll indicator */}
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{
              duration: 2.8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute bottom-8 left-8 flex items-center gap-3"
          >
            <div className="h-10 w-px bg-gradient-to-b from-[rgba(245,240,235,0.25)] to-transparent" />
            <span
              style={{ writingMode: "vertical-rl" }}
              className="font-mono text-[9px] uppercase tracking-[0.45em] text-[rgba(245,240,235,0.18)]"
            >
              Scroll
            </span>
          </motion.div>

          {/* Bottom-right serial */}
          <div className="absolute bottom-8 right-8 font-mono text-[9px] uppercase tracking-[0.35em] text-[rgba(245,240,235,0.18)]">
            001
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 2 — REVERSAL (#f5f0eb)                                */}
      {/* ============================================================ */}
      <section className="bg-[#f5f0eb] py-20 md:py-28">
        <DrawLine color="#c9a84c" delay={0} />
        <div className="grid grid-cols-3 divide-x divide-[rgba(10,10,10,0.1)]">
          <div className="px-8 py-12 text-center">
            <div className="text-[clamp(4rem,8vw,7rem)] font-black tabular-nums leading-none text-[#0a0a0a]">
              01
            </div>
            <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.45em] text-[rgba(10,10,10,0.35)]">
              Evidence Kit
            </div>
          </div>
          <div className="px-8 py-12 text-center">
            <div className="text-[clamp(4rem,8vw,7rem)] font-black tabular-nums leading-none text-[#0a0a0a]">
              03
            </div>
            <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.45em] text-[rgba(10,10,10,0.35)]">
              Case Stages
            </div>
          </div>
          <div className="px-8 py-12 text-center">
            <div className="text-[clamp(4rem,8vw,7rem)] font-black tabular-nums leading-none text-[#0a0a0a]">
              <CountUp target={90} suffix="+" />
            </div>
            <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.45em] text-[rgba(10,10,10,0.35)]">
              Minutes Avg.
            </div>
          </div>
        </div>
        <div className="border-t border-[rgba(10,10,10,0.08)] pb-4 pt-12">
          <div className="text-center font-mono text-[11px] uppercase tracking-[0.45em] text-[rgba(10,10,10,0.3)]">
            Physical + Digital Investigation Experience
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 3 — DEPTH (#040414)                                   */}
      {/* ============================================================ */}
      <section className="bg-[#040414] px-8 py-24 md:px-16 md:py-32 lg:px-24">
        <div className="grid gap-20 lg:grid-cols-[1fr_1fr]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.9, ease: EASE }}
            className="lg:sticky lg:top-28 lg:self-start"
          >
            <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-[rgba(245,240,235,0.3)]">
              — Distinction
            </div>
            <p className="mt-8 text-[clamp(2rem,3.5vw,3rem)] font-bold leading-[1.1] tracking-tight text-[#f5f0eb]">
              Not a board game. Not a puzzle kit. A cold case file that rewards
              serious investigation.
            </p>
            <p className="mt-8 text-[15px] leading-[1.9] text-[rgba(245,240,235,0.45)]">
              Not random complexity. Not puzzle mechanics for their own sake. A
              premium case file with real structure, staged evidence, and a
              serious review layer.
            </p>
          </motion.div>

          <div className="space-y-0">
            {home.differentiators.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{
                  duration: 0.7,
                  ease: EASE,
                  delay: index * 0.15,
                }}
              >
                <DrawLine
                  delay={index * 0.1}
                  color="rgba(245,240,235,0.07)"
                />
                <div className="py-8">
                  <div className="flex items-start gap-4">
                    <span className="mt-1 font-mono text-[11px] tabular-nums text-[rgba(245,240,235,0.25)]">
                      0{index + 1}
                    </span>
                    <div>
                      <h3 className="text-[17px] font-semibold text-[#f5f0eb]">
                        {item.title}
                      </h3>
                      <p className="mt-3 text-[14px] leading-[1.8] text-[rgba(245,240,235,0.45)]">
                        {item.text}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
            <DrawLine color="rgba(245,240,235,0.07)" />
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 4 — WARMTH / HOW IT WORKS (#0e0600)                   */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden bg-[#0e0600] px-8 py-24 md:px-16 md:py-32 lg:px-24">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-[200px] w-[700px] -translate-x-1/2 bg-[radial-gradient(ellipse,rgba(201,168,76,0.07),transparent_70%)]"
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-[rgba(245,240,235,0.3)]">
            Process
          </div>
          <h2 className="mt-4 text-[clamp(2rem,3.5vw,3rem)] font-bold text-[#f5f0eb]">
            Three steps. One investigation.
          </h2>
        </motion.div>

        <div className="mt-14 grid gap-12 lg:grid-cols-3 lg:gap-0">
          {home.howSteps.map((step, index) => {
            const isFirst = index === 0;
            const isLast = index === home.howSteps.length - 1;
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{
                  duration: 0.7,
                  ease: EASE,
                  delay: index * 0.15,
                }}
                className={clsx(
                  "relative",
                  isFirst
                    ? "lg:pl-0 lg:pr-10"
                    : isLast
                      ? "lg:pl-10 lg:pr-0"
                      : "lg:px-10"
                )}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#c9a84c]/30 bg-[#c9a84c]/[0.08]">
                  <span className="font-mono text-[12px] text-[#c9a84c]">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-[17px] font-semibold text-[#f5f0eb]">
                  {step.title}
                </h3>
                <p className="mt-3 text-[14px] leading-[1.8] text-[rgba(245,240,235,0.45)]">
                  {step.text}
                </p>
                {!isLast ? (
                  <div
                    aria-hidden
                    className="absolute right-0 top-4 hidden h-12 w-px bg-gradient-to-b from-[rgba(201,168,76,0.25)] to-transparent lg:block"
                  />
                ) : null}
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 5 — THE PRODUCT / FEATURED (#000000) + parallax       */}
      {/* ============================================================ */}
      <section
        ref={featuredRef}
        className="relative overflow-hidden bg-[#000000] px-8 py-24 md:px-16 md:py-32 lg:px-24"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(201,168,76,0.05),transparent_50%)]"
        />

        <div className="grid items-center gap-16 lg:grid-cols-[1fr_0.65fr]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-[rgba(245,240,235,0.3)]">
              Featured Investigation
            </div>
            <DrawLine
              className="mt-4"
              color="rgba(245,240,235,0.08)"
            />
            <h2 className="mt-6 text-[clamp(2rem,3.5vw,3rem)] font-bold text-[#f5f0eb]">
              {featuredCase.title}
            </h2>
            <p className="mt-4 text-[15px] leading-[1.8] text-[rgba(245,240,235,0.5)]">
              {featuredCase.summary}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <FeaturedPill label={featuredCase.players} />
              <FeaturedPill label={featuredCase.duration} />
              <FeaturedPill label={featuredCase.difficulty} />
            </div>
            <a
              href={featuredCase.href}
              className="group mt-8 inline-flex items-center gap-3 text-[14px] text-[#f5f0eb] transition"
            >
              <ArrowRight
                size={16}
                strokeWidth={2}
                className="transition-transform group-hover:translate-x-1.5"
              />
              <span>Open Case File</span>
            </a>
          </motion.div>

          <motion.div
            style={{ y: cardY }}
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="overflow-hidden rounded-2xl border border-[rgba(245,240,235,0.08)] bg-[rgba(245,240,235,0.025)]"
          >
            <div className="flex items-center justify-between border-b border-[rgba(245,240,235,0.06)] bg-[rgba(245,240,235,0.02)] px-5 py-3">
              <span className="font-mono text-[9px] uppercase tracking-[0.4em] text-[rgba(245,240,235,0.2)]">
                Investigation File
              </span>
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#c9a84c]"
                />
                <span className="font-mono text-[9px] text-[rgba(245,240,235,0.3)]">
                  Active
                </span>
              </span>
            </div>
            <div className="p-5">
              <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[rgba(245,240,235,0.2)]">
                BL-{featuredCase.id}
              </div>
              <p className="mt-2 text-[14px] font-semibold text-[#f5f0eb]">
                {featuredCase.title}
              </p>
              <div className="mt-4 space-y-2.5">
                <FileRow label="Operatives" value={featuredCase.players} />
                <FileRow label="Duration" value={featuredCase.duration} />
                <FileRow label="Tier" value={featuredCase.difficulty} />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 6 — CLOSE / WAITLIST (#050009)                        */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden bg-[#050009] px-8 py-24 md:px-16 md:py-32 lg:px-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(80,30,120,0.12),transparent_55%)]"
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="relative max-w-xl"
        >
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-[rgba(245,240,235,0.3)]">
            Bureau Intelligence
          </div>
          <DrawLine
            className="mt-4"
            color="rgba(245,240,235,0.07)"
            delay={0.2}
          />
          <h2 className="mt-6 text-[clamp(2rem,3vw,2.6rem)] font-bold text-[#f5f0eb]">
            Get updates on new case releases and bureau announcements.
          </h2>
          <p className="mt-4 text-[14px] leading-[1.8] text-[rgba(245,240,235,0.4)]">
            No spam. Case release announcements and bureau updates only.
          </p>
          <div className="mt-8">
            <WaitlistForm />
          </div>
        </motion.div>
      </section>
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================

type WordRevealProps = {
  text: string;
  className?: string;
  baseDelay?: number;
  inView: boolean;
};

function WordReveal({
  text,
  className,
  baseDelay = 0,
  inView,
}: WordRevealProps) {
  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          className="mr-[0.22em] inline-block overflow-hidden"
        >
          <motion.span
            className="inline-block"
            initial={{ y: "110%" }}
            animate={inView ? { y: "0%" } : { y: "110%" }}
            transition={{
              duration: 0.65,
              ease: EASE,
              delay: baseDelay + index * 0.09,
            }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

type CountUpProps = {
  target: number;
  suffix?: string;
  duration?: number;
};

function CountUp({ target, suffix = "", duration = 1.5 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let frame = 0;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isInView, target, duration]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

type MagneticLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

function MagneticLink({ href, className, children }: MagneticLinkProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  function handleMouseMove(event: React.MouseEvent<HTMLAnchorElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const offsetX = (event.clientX - rect.left - rect.width / 2) * 0.3;
    const offsetY = (event.clientY - rect.top - rect.height / 2) * 0.3;
    setPos({ x: offsetX, y: offsetY });
  }

  function handleMouseLeave() {
    setPos({ x: 0, y: 0 });
  }

  return (
    <motion.a
      ref={ref}
      href={href}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: pos.x, y: pos.y }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
    >
      {children}
    </motion.a>
  );
}

type DrawLineProps = {
  className?: string;
  delay?: number;
  color?: string;
};

function DrawLine({ className, delay = 0, color }: DrawLineProps) {
  return (
    <motion.div
      aria-hidden
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, amount: 1 }}
      transition={{ duration: 1.0, ease: EASE, delay }}
      style={{
        originX: 0,
        backgroundColor: color ?? "rgba(255,255,255,0.12)",
      }}
      className={clsx("h-px w-full", className)}
    />
  );
}

// ---- micro components used in section 1 + 5 ----

function FloatStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-[16px] font-semibold text-[#f5f0eb]">{value}</div>
      <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.2em] text-[rgba(245,240,235,0.25)]">
        {label}
      </div>
    </div>
  );
}

function FeaturedPill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-[rgba(245,240,235,0.1)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[rgba(245,240,235,0.4)]">
      {label}
    </span>
  );
}

function FileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-t border-[rgba(245,240,235,0.05)] py-2">
      <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-[rgba(245,240,235,0.25)]">
        {label}
      </span>
      <span className="font-mono text-[11px] text-[rgba(245,240,235,0.55)]">
        {value}
      </span>
    </div>
  );
}
