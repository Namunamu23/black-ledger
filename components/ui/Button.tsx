import clsx from "clsx";
import type { MouseEventHandler, ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "rounded-2xl bg-amber-400 font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70",
  outline:
    "rounded-2xl border border-zinc-700 font-semibold text-white transition hover:bg-zinc-800",
  ghost: "font-semibold text-zinc-400 transition hover:text-white",
  danger:
    "rounded-2xl bg-red-600 font-semibold text-white transition hover:bg-red-500 disabled:opacity-70",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-3 text-sm",
  lg: "px-6 py-4 text-base",
};

type ButtonProps = {
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit" | "reset";
  className?: string;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  disabled,
  onClick,
  type = "button",
  className,
  children,
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={clsx(VARIANT_CLASSES[variant], SIZE_CLASSES[size], className)}
    >
      {children}
    </button>
  );
}
