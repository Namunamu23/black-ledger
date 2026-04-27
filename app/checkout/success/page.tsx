import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, Pill } from "@/components/ui";

type PageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function CheckoutSuccessPage({ searchParams }: PageProps) {
  const { session_id: sessionId } = await searchParams;

  const order = sessionId
    ? await prisma.order.findUnique({
        where: { stripeSessionId: sessionId },
        select: { status: true, email: true },
      })
    : null;

  const isComplete = order?.status === "COMPLETE";
  const email = order?.email ?? null;

  return (
    <main className="relative min-h-screen bg-[#050507] text-zinc-100">
      <div className="relative mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <Card variant="dossier" padding="lg">
          {isComplete ? (
            <>
              <Pill tone="success" label="Order complete" />
              <h1 className="mt-4 text-2xl font-semibold text-white">
                Activation code sent
              </h1>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Your activation code has been sent to{" "}
                <span className="font-mono text-zinc-200">{email}</span>. Check
                your inbox, sign in to the bureau, and redeem it to begin the
                investigation.
              </p>
              <Link
                href="/bureau"
                className="mt-6 inline-flex items-center justify-center rounded-2xl bg-amber-400 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-amber-300"
              >
                Go to bureau
              </Link>
            </>
          ) : (
            <>
              <Pill tone="warning" label="Processing" />
              <h1 className="mt-4 text-2xl font-semibold text-white">
                Your order is processing
              </h1>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Payment confirmed. Your activation code will arrive by email
                shortly. If you don&apos;t see it within a few minutes, check
                your spam folder or contact support.
              </p>
              <Link
                href="/"
                className="mt-6 inline-flex items-center justify-center rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Back to home
              </Link>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
