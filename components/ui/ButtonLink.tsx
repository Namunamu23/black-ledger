import Link from "next/link";
import clsx from "clsx";

type ButtonLinkProps = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
};

export default function ButtonLink({
  href,
  children,
  variant = "primary",
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={clsx(
        "inline-flex rounded-2xl px-6 py-3 font-semibold transition",
        variant === "primary"
          ? "bg-amber-400 text-zinc-950 hover:bg-amber-300"
          : "border border-zinc-700 text-white hover:bg-zinc-900"
      )}
    >
      {children}
    </Link>
  );
}