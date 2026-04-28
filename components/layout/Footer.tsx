import Link from "next/link";
import { siteConfig } from "@/data/site";

export default function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-10 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="text-xs uppercase tracking-[0.35em] text-zinc-400">
              {siteConfig.brand.name}
            </div>
            <p className="mt-4 max-w-md text-sm leading-7 text-zinc-500">
              {siteConfig.brand.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm text-zinc-500 sm:grid-cols-3">
            {siteConfig.navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="transition hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-800/50 pt-6">
          <div className="text-xs text-zinc-600">
            © {new Date().getFullYear()} Black Ledger. All rights reserved.
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <Link
              href="/privacy"
              className="transition hover:text-white"
            >
              Privacy
            </Link>
            <span aria-hidden="true" className="text-zinc-700">
              ·
            </span>
            <Link
              href="/terms"
              className="transition hover:text-white"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
