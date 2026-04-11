import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.35em] text-zinc-400">
              Black Ledger
            </div>
            <p className="mt-3 max-w-md text-sm leading-7 text-zinc-500">
              Premium physical case files and digital bureau access for immersive
              at-home investigations.
            </p>
          </div>

          <div className="flex flex-wrap gap-6 text-sm text-zinc-500">
            <Link href="/about" className="hover:text-white">About</Link>
            <Link href="/faq" className="hover:text-white">FAQ</Link>
            <Link href="/support" className="hover:text-white">Support</Link>
            <Link href="/login" className="hover:text-white">Login</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}