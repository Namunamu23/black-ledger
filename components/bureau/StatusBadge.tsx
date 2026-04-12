type StatusBadgeProps = {
  status: string;
};

const statusMap: Record<
  string,
  { label: string; className: string }
> = {
  ACTIVE: {
    label: "Active",
    className:
      "border-zinc-700 bg-zinc-900 text-zinc-300",
  },
  FINAL_REVIEW: {
    label: "Final Review",
    className:
      "border-amber-500/30 bg-amber-500/10 text-amber-300",
  },
  SOLVED: {
    label: "Solved",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  SUBMITTED: {
    label: "Submitted",
    className:
      "border-sky-500/30 bg-sky-500/10 text-sky-300",
  },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config =
    statusMap[status] ??
    {
      label: status,
      className: "border-zinc-700 bg-zinc-900 text-zinc-300",
    };

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}