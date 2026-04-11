import Link from "next/link";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-200"
        >
          Black Ledger
        </Link>

        <nav className="hidden gap-6 text-sm text-zinc-400 md:flex">
          <Link href="/cases/alder-street-review" className="hover:text-white">
            Case 001
          </Link>
          <Link href="/how-it-works" className="hover:text-white">
            How It Works
          </Link>
          <Link href="/about" className="hover:text-white">
            About
          </Link>
          <Link href="/faq" className="hover:text-white">
            FAQ
          </Link>
          <Link href="/support" className="hover:text-white">
            Support
          </Link>
          <Link href="/login" className="hover:text-white">
            Login
          </Link>
        </nav>
      </div>
    </header>
  );
}