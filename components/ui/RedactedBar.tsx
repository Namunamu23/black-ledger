import clsx from "clsx";

type Width = "sm" | "md" | "lg" | "full";
type Height = "sm" | "md";

const WIDTH_CLASSES: Record<Width, string> = {
  sm: "w-24",
  md: "w-48",
  lg: "w-64",
  full: "w-full",
};

const HEIGHT_CLASSES: Record<Height, string> = {
  sm: "h-4",
  md: "h-5",
};

type RedactedBarProps = {
  width?: Width;
  height?: Height;
  className?: string;
};

export function RedactedBar({
  width = "md",
  height = "sm",
  className,
}: RedactedBarProps) {
  // inline-block + align-middle so the bar can sit inline with text
  // ("the witness identified [REDACTED] at the scene") or as a standalone
  // block element without a wrapping container caring about display mode.
  return (
    <span
      className={clsx(
        "inline-block align-middle bg-zinc-700 rounded-sm",
        WIDTH_CLASSES[width],
        HEIGHT_CLASSES[height],
        className
      )}
      aria-hidden="true"
    />
  );
}
