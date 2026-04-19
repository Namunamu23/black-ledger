import { UserCaseStatus } from "@/generated/prisma/client";
import { CASE_STATUS_LABEL } from "@/lib/labels";

type StatusBadgeProps = {
  status: UserCaseStatus;
};

const STATUS_TONE: Record<UserCaseStatus, string> = {
  [UserCaseStatus.NOT_STARTED]:
    "border-zinc-700 bg-zinc-900 text-zinc-400",
  [UserCaseStatus.ACTIVE]:
    "border-zinc-700 bg-zinc-900 text-zinc-300",
  [UserCaseStatus.FINAL_REVIEW]:
    "border-amber-500/30 bg-amber-500/10 text-amber-300",
  [UserCaseStatus.SOLVED]:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-medium ${STATUS_TONE[status]}`}
    >
      {CASE_STATUS_LABEL[status]}
    </span>
  );
}
