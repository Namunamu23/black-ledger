import { auth } from "@/auth";
import { notFound } from "next/navigation";
import GlobalPeopleSearchTerminal from "@/components/bureau/GlobalPeopleSearchTerminal";

export default async function BureauGlobalDatabasePage() {
  const session = await auth();

  if (!session?.user) {
    notFound();
  }

  // Intentional: NO Prisma data fetch on initial render. The page renders an
  // empty terminal; the search-on-submit flow lives in the client component
  // and the `searchBureauPeople` server action at ./actions.ts. This is the
  // closure for the Cowork audit's P2-8 ("/bureau/database loads every
  // GlobalPerson unbounded") — every search now hits the index with a
  // narrow projection and a hard cap.

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050507] text-zinc-100">
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(185,28,28,0.22),transparent_30%),radial-gradient(circle_at_78%_4%,rgba(14,116,144,0.18),transparent_28%),radial-gradient(circle_at_50%_90%,rgba(245,158,11,0.10),transparent_34%),linear-gradient(to_bottom,#050507,#09090b_52%,#030304)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:54px_54px] opacity-25"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[repeating-linear-gradient(to_bottom,rgba(255,255,255,0.035)_0px,rgba(255,255,255,0.035)_1px,transparent_1px,transparent_5px)] opacity-[0.045]"
        aria-hidden
      />
      <div
        className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-red-500/60 to-transparent"
        aria-hidden
      />
      <div
        className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-amber-400/40 to-transparent"
        aria-hidden
      />

      <div className="relative">
        <GlobalPeopleSearchTerminal />
      </div>
    </main>
  );
}
