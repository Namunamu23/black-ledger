import clsx from "clsx";

type Tone = "red" | "amber" | "green" | "cyan";
type Size = "sm" | "md" | "lg";

const TONE_CLASSES: Record<Tone, string> = {
  red: "text-red-500/80 border-red-500/60",
  amber: "text-amber-400/80 border-amber-400/60",
  green: "text-emerald-400/80 border-emerald-400/60",
  cyan: "text-cyan-400/80 border-cyan-400/60",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "text-xs px-3 py-1",
  md: "text-sm px-4 py-2",
  lg: "text-base px-5 py-2.5",
};

type StampBadgeProps = {
  label: string;
  tone?: Tone;
  rotate?: boolean;
  size?: Size;
  className?: string;
};

export function StampBadge({
  label,
  tone = "red",
  rotate = false,
  size = "md",
  className,
}: StampBadgeProps) {
  return (
    <div
      className={clsx(
        "inline-block border-2 rounded font-mono uppercase tracking-[0.4em] font-black",
        TONE_CLASSES[tone],
        SIZE_CLASSES[size],
        rotate && "-rotate-6",
        className
      )}
    >
      {label}
    </div>
  );
}
