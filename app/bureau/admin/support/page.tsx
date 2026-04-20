import Link from "next/link";
import { prisma } from "@/lib/prisma";
import SectionHeader from "@/components/ui/SectionHeader";
import Reveal from "@/components/ui/Reveal";

const STATUS_VALUES = ["NEW", "HANDLED", "SPAM"] as const;
type StatusValue = (typeof STATUS_VALUES)[number];

const STATUS_LABEL: Record<StatusValue, string> = {
  NEW: "New",
  HANDLED: "Handled",
  SPAM: "Spam",
};

const PAGE_SIZE = 25;

function parseStatus(raw: string | undefined): StatusValue {
  const upper = raw?.toUpperCase();
  return (STATUS_VALUES as readonly string[]).includes(upper ?? "")
    ? (upper as StatusValue)
    : "NEW";
}

function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

type PageProps = {
  searchParams: Promise<{ status?: string; page?: string }>;
};

export default async function AdminSupportInboxPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const status = parseStatus(params.status);
  const page = parsePage(params.page);

  // One query for the per-status counts; one query for the active page rows.
  const [counts, total, rows] = await Promise.all([
    prisma.supportMessage.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.supportMessage.count({ where: { status } }),
    prisma.supportMessage.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const countByStatus = STATUS_VALUES.reduce<Record<StatusValue, number>>(
    (acc, s) => {
      const row = counts.find((c) => c.status === s);
      acc[s] = row?._count._all ?? 0;
      return acc;
    },
    { NEW: 0, HANDLED: 0, SPAM: 0 }
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="bg-zinc-950 text-white">
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <SectionHeader
              eyebrow="Admin"
              title="Support inbox"
              text="Messages submitted via the public support form. Filter by status, open one to reply."
            />
          </Reveal>

          <Reveal delay={0.05}>
            <div className="mt-8 flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
              {STATUS_VALUES.map((s) => {
                const isActive = s === status;
                return (
                  <Link
                    key={s}
                    href={`/bureau/admin/support?status=${s}`}
                    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "bg-white text-zinc-950"
                        : "border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
                    }`}
                  >
                    {STATUS_LABEL[s]}
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                        isActive
                          ? "bg-zinc-950 text-zinc-300"
                          : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {countByStatus[s]}
                    </span>
                  </Link>
                );
              })}
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="mt-6 overflow-x-auto rounded-[2rem] border border-zinc-800 bg-zinc-900">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-800 text-xs uppercase tracking-[0.2em] text-zinc-500">
                  <tr>
                    <th className="px-6 py-4">From</th>
                    <th className="px-6 py-4">Message</th>
                    <th className="px-6 py-4">Received</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-6 py-8 text-center text-zinc-500"
                      >
                        No {STATUS_LABEL[status].toLowerCase()} messages.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-zinc-800/60 transition last:border-b-0 hover:bg-zinc-950"
                      >
                        <td className="px-6 py-4">
                          <Link
                            href={`/bureau/admin/support/${row.id}`}
                            className="block"
                          >
                            <div className="font-semibold text-white">
                              {row.name}
                            </div>
                            <div className="text-xs text-zinc-400">
                              {row.email}
                            </div>
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-zinc-300">
                          <Link
                            href={`/bureau/admin/support/${row.id}`}
                            className="block"
                          >
                            {truncate(row.message, 80)}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-zinc-400">
                          <Link
                            href={`/bureau/admin/support/${row.id}`}
                            className="block"
                          >
                            {row.createdAt.toISOString().slice(0, 10)}
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Reveal>

          {totalPages > 1 ? (
            <Reveal delay={0.1}>
              <div className="mt-6 flex items-center justify-between text-sm text-zinc-400">
                <div>
                  Page {page} of {totalPages}
                </div>
                <div className="flex gap-2">
                  {page > 1 ? (
                    <Link
                      href={`/bureau/admin/support?status=${status}&page=${
                        page - 1
                      }`}
                      className="rounded-2xl border border-zinc-700 px-4 py-2 font-semibold text-white transition hover:bg-zinc-900"
                    >
                      Previous
                    </Link>
                  ) : (
                    <span className="rounded-2xl border border-zinc-800 px-4 py-2 font-semibold text-zinc-600">
                      Previous
                    </span>
                  )}
                  {page < totalPages ? (
                    <Link
                      href={`/bureau/admin/support?status=${status}&page=${
                        page + 1
                      }`}
                      className="rounded-2xl border border-zinc-700 px-4 py-2 font-semibold text-white transition hover:bg-zinc-900"
                    >
                      Next
                    </Link>
                  ) : (
                    <span className="rounded-2xl border border-zinc-800 px-4 py-2 font-semibold text-zinc-600">
                      Next
                    </span>
                  )}
                </div>
              </div>
            </Reveal>
          ) : null}
        </div>
      </section>
    </main>
  );
}
