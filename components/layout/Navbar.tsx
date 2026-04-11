"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { Menu, X } from "lucide-react";
import { siteConfig } from "@/data/site";

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="text-sm font-semibold uppercase tracking-[0.35em] text-zinc-100"
        >
          {siteConfig.brand.name}
        </Link>

        <div className="hidden items-center gap-3 md:flex">
          <nav className="flex items-center gap-2">
            {siteConfig.navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "rounded-full px-3 py-2 text-sm transition",
                    isActive
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <Link
            href="/bureau"
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
          >
            Access Bureau
          </Link>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setOpen((prev) => !prev)}
          className="rounded-xl border border-zinc-800 p-2 text-zinc-300 transition hover:bg-zinc-900 md:hidden"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-zinc-800 bg-zinc-950 md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col px-6 py-4">
            {siteConfig.navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={clsx(
                    "rounded-xl px-3 py-3 text-sm transition",
                    isActive
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}

            <Link
              href="/bureau"
              onClick={() => setOpen(false)}
              className="mt-3 rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
            >
              Access Bureau
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}