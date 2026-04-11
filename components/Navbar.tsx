import Link from "next/link";

export default function Navbar() {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-sm font-medium tracking-[0.3em] uppercase text-zinc-300">
          Black Ledger
        </Link>

        <nav className="flex gap-6 text-sm text-zinc-400">
          <Link href="/cases/alder-street-review" className="hover:text-white">Case 001</Link>
          <Link href="/how-it-works" className="hover:text-white">How It Works</Link>
          <Link href="/about" className="hover:text-white">About</Link>
          <Link href="/faq" className="hover:text-white">FAQ</Link>
          <Link href="/support" className="hover:text-white">Support</Link>
        </nav>
      </div>
    </header>
  );
}