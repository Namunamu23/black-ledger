"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { Menu, X } from "lucide-react";
import { siteConfig } from "@/data/site";
import SignOutButton from "@/components/auth/SignOutButton";

type NavbarSession = {
  user: {
    email?: string | null;
    name?: string | null;
    role?: string;
  };
} | null;

type NavbarProps = {
  session?: NavbarSession;
};

function deriveOperativeId(session: NonNullable<NavbarSession>): string {
  const raw =
    session.user.email?.split("@")[0] ?? session.user.name ?? "operative";
  return raw.length > 16 ? raw.slice(0, 16) : raw;
}

export default function Navbar({ session }: NavbarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // When the user is signed in, hide the /login nav item — it's redundant
  // and would just bounce them back to the bureau.
  const navItems = session
    ? siteConfig.navItems.filter((item) => item.href !== "/login")
    : siteConfig.navItems;

  const operativeId = session ? deriveOperativeId(session) : null;

  return (
    <header className="sticky top-0 z-50 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(8,8,8,0.92)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="text-sm font-semibold uppercase tracking-[0.35em] text-[#f5f0eb]"
        >
          {siteConfig.brand.name}
        </Link>

        <div className="hidden items-center gap-3 md:flex">
          <nav className="flex items-center gap-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "rounded-full px-3 py-2 text-sm transition",
                    isActive
                      ? "bg-[rgba(245,240,235,0.08)] text-[#f5f0eb]"
                      : "text-[rgba(245,240,235,0.4)] hover:bg-[rgba(245,240,235,0.06)] hover:text-[#f5f0eb]"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {session ? (
            <>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[rgba(245,240,235,0.4)]">
                OP · {operativeId}
              </span>
              <Link
                href="/bureau"
                className="rounded-full bg-[#c9a84c] px-4 py-2 text-sm font-semibold text-[#080808] transition hover:bg-[#d4b55a]"
              >
                Bureau
              </Link>
              <SignOutButton />
            </>
          ) : (
            <Link
              href="/bureau"
              className="rounded-full bg-[#c9a84c] px-4 py-2 text-sm font-semibold text-[#080808] transition hover:bg-[#d4b55a]"
            >
              Access Bureau
            </Link>
          )}
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setOpen((prev) => !prev)}
          className="rounded-xl border border-[rgba(255,255,255,0.08)] p-2 text-[rgba(245,240,235,0.5)] transition hover:bg-[rgba(245,240,235,0.05)] md:hidden"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-[rgba(255,255,255,0.06)] bg-[#080808] md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col px-6 py-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={clsx(
                    "rounded-xl px-3 py-3 text-sm transition",
                    isActive
                      ? "bg-[rgba(245,240,235,0.08)] text-[#f5f0eb]"
                      : "text-[rgba(245,240,235,0.4)] hover:bg-[rgba(245,240,235,0.06)] hover:text-[#f5f0eb]"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}

            {session ? (
              <>
                <div className="mt-3 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[rgba(245,240,235,0.4)]">
                  OP · {operativeId}
                </div>
                <Link
                  href="/bureau"
                  onClick={() => setOpen(false)}
                  className="mt-3 rounded-xl bg-[#c9a84c] px-4 py-3 text-center text-sm font-semibold text-[#080808] transition hover:bg-[#d4b55a]"
                >
                  Bureau
                </Link>
                <div className="mt-3 flex justify-center">
                  <SignOutButton />
                </div>
              </>
            ) : (
              <Link
                href="/bureau"
                onClick={() => setOpen(false)}
                className="mt-3 rounded-xl bg-[#c9a84c] px-4 py-3 text-center text-sm font-semibold text-[#080808] transition hover:bg-[#d4b55a]"
              >
                Access Bureau
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
