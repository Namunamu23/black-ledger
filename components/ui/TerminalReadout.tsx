import clsx from "clsx";

type Tone = "green" | "amber" | "cyan" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  green: "text-emerald-400/80",
  amber: "text-amber-300/80",
  cyan: "text-cyan-300/80",
  neutral: "text-zinc-300",
};

type TerminalReadoutProps = {
  label?: string;
  lines: string[] | string;
  tone?: Tone;
  className?: string;
};

export function TerminalReadout({
  label,
  lines,
  tone = "green",
  className,
}: TerminalReadoutProps) {
  const content = Array.isArray(lines)
    ? lines.map((line, i) => <div key={i}>{line}</div>)
    : lines;

  return (
    <div className={className}>
      {label ? (
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-2">
          {label}
        </div>
      ) : null}
      <div
        className={clsx(
          "rounded-xl border border-zinc-800 bg-black px-4 py-3 font-mono text-sm leading-6",
          TONE_CLASSES[tone]
        )}
      >
        {content}
      </div>
    </div>
  );
}
