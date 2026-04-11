"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ redirectTo: "/" })}
      className="rounded-2xl border border-zinc-700 px-5 py-3 font-semibold text-white transition hover:bg-zinc-900"
    >
      Sign Out
    </button>
  );
}