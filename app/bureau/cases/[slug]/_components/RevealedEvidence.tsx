"use client";

import { motion } from "framer-motion";

export type RecordContent = {
  type: "record";
  record: { id: number; title: string; body: string };
};
export type PersonContent = {
  type: "person";
  person: { id: number; name: string; summary: string };
};
export type HintContent = {
  type: "hint";
  hint: { id: number; title: string; content: string };
};
export type ResolvedEvidence = RecordContent | PersonContent | HintContent;

type Props = { items: ResolvedEvidence[] };

/**
 * Renders content the player has unlocked via the physical-to-digital
 * AccessCode flow. Items are pre-resolved server-side; this component is
 * client-only because Framer Motion's `motion.div` requires browser
 * runtime for the entrance animation.
 *
 * Returns null when there is nothing to show — the section never renders
 * an empty heading.
 */
export default function RevealedEvidence({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <section className="border-b border-zinc-900 py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
          Revealed Evidence
        </div>
        <h2 className="mt-4 text-3xl font-semibold text-white">
          Unlocked from physical artifacts
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400">
          Records, subjects, and hints you have surfaced by redeeming access
          codes from the field.
        </p>

        <div className="mt-8 grid gap-4">
          {items.map((item, index) => (
            <motion.div
              key={evidenceKey(item)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="rounded-[2rem] border border-emerald-500/20 bg-zinc-900 p-6"
            >
              <EvidenceBody item={item} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function evidenceKey(item: ResolvedEvidence): string {
  if (item.type === "record") return `record-${item.record.id}`;
  if (item.type === "person") return `person-${item.person.id}`;
  return `hint-${item.hint.id}`;
}

function EvidenceBody({ item }: { item: ResolvedEvidence }) {
  if (item.type === "record") {
    return (
      <article>
        <div className="text-xs uppercase tracking-[0.25em] text-emerald-400">
          Record
        </div>
        <h3 className="mt-3 text-2xl font-semibold text-white">
          {item.record.title}
        </h3>
        <p className="mt-4 whitespace-pre-line text-sm leading-7 text-zinc-200">
          {item.record.body}
        </p>
      </article>
    );
  }

  if (item.type === "person") {
    return (
      <article>
        <div className="text-xs uppercase tracking-[0.25em] text-emerald-400">
          Subject
        </div>
        <h3 className="mt-3 text-2xl font-semibold text-white">
          {item.person.name}
        </h3>
        <p className="mt-4 whitespace-pre-line text-sm leading-7 text-zinc-200">
          {item.person.summary}
        </p>
      </article>
    );
  }

  return (
    <article>
      <div className="text-xs uppercase tracking-[0.25em] text-emerald-400">
        Hint
      </div>
      <h3 className="mt-3 text-2xl font-semibold text-white">
        {item.hint.title}
      </h3>
      <p className="mt-4 whitespace-pre-line text-sm leading-7 text-zinc-200">
        {item.hint.content}
      </p>
    </article>
  );
}
