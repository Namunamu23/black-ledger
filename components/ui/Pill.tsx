import clsx from "clsx";

type Tone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "classified";

type Variant = "status" | "classification" | "severity" | "default";

const BASE =
  "font-mono text-[10px] uppercase tracking-[0.24em] rounded-full px-3 py-1 border";

const TONE_CLASSES: Record<Tone, string> = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  danger: "border-red-500/30 bg-red-500/10 text-red-300",
  info: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  neutral: "border-zinc-700 bg-zinc-900 text-zinc-400",
  classified: "border-red-500/40 bg-red-950/40 text-red-200",
};

type PillProps = {
  tone: Tone;
  variant?: Variant;
  label: string;
  className?: string;
};

export function Pill({
  tone,
  variant = "default",
  label,
  className,
}: PillProps) {
  // The classification variant prepends a glyph that reads as a lock icon
  // at small sizes without pulling in an icon library. The other variants
  // currently share the same look — they exist as semantic labels so
  // callers can communicate intent without committing to bespoke styling.
  const text = variant === "classification" ? `• ${label}` : label;
  return (
    <span className={clsx(BASE, TONE_CLASSES[tone], className)}>{text}</span>
  );
}
