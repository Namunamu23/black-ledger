import clsx from "clsx";
import type { ReactNode } from "react";

type Variant = "bureau" | "dossier" | "marketing";
type Padding = "none" | "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
  bureau: "rounded-[2rem] border border-zinc-800 bg-zinc-900",
  dossier:
    "overflow-hidden rounded-[1.75rem] border border-red-950/60 bg-black/55 shadow-2xl shadow-black/60 backdrop-blur-xl",
  marketing: "rounded-[2rem] border border-zinc-800/50 bg-zinc-900/80",
};

const PADDING_CLASSES: Record<Padding, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

type CardProps = {
  variant?: Variant;
  padding?: Padding;
  className?: string;
  children: ReactNode;
};

export function Card({
  variant = "bureau",
  padding = "md",
  className,
  children,
}: CardProps) {
  return (
    <div
      className={clsx(
        VARIANT_CLASSES[variant],
        PADDING_CLASSES[padding],
        className
      )}
    >
      {children}
    </div>
  );
}
