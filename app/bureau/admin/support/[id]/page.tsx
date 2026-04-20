import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SectionHeader from "@/components/ui/SectionHeader";
import Reveal from "@/components/ui/Reveal";
import ReplyForm from "./_components/ReplyForm";
import StatusActions from "./_components/StatusActions";

const STATUS_LABEL = {
  NEW: "New",
  HANDLED: "Handled",
  SPAM: "Spam",
} as const;

const STATUS_TONE = {
  NEW: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  HANDLED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  SPAM: "border-red-500/30 bg-red-500/10 text-red-400",
} as const;

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminSupportDetailPage({ params }: PageProps) {
  const { id } = await params;
  const parsedId = Number(id);
  if (!Number.isInteger(parsedId)) {
    notFound();
  }

  const message = await prisma.supportMessage.findUnique({
    where: { id: parsedId },
  });
  if (!message) {
    notFound();
  }

  return (
    <main className="bg-zinc-950 text-white">
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6">
          <Reveal>
            <Link
              href={`/bureau/admin/support?status=${message.status}`}
              className="text-sm text-zinc-400 transition hover:text-white"
            >
              ← Back to inbox
            </Link>
          </Reveal>

          <Reveal delay={0.05}>
            <div className="mt-4">
              <SectionHeader
                eyebrow="Support message"
                title={message.name}
                text={message.email}
              />
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="mt-8 flex flex-wrap items-center gap-4 text-sm">
              <span
                className={`rounded-full border px-3 py-1 text-xs font-medium ${STATUS_TONE[message.status]}`}
              >
                {STATUS_LABEL[message.status]}
              </span>
              <span className="text-zinc-500">
                Received {message.createdAt.toISOString().slice(0, 10)}
              </span>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mt-6 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Message
              </div>
              <p className="mt-4 whitespace-pre-line text-base leading-7 text-zinc-200">
                {message.message}
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="mt-8">
              <StatusActions
                messageId={message.id}
                currentStatus={message.status}
              />
            </div>
          </Reveal>

          <Reveal delay={0.14}>
            <div className="mt-8">
              <ReplyForm messageId={message.id} recipient={message.email} />
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
