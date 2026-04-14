"use client";

import { evaluateCaseReadiness, type CaseContentForQualityCheck } from "@/lib/case-quality";

type CaseReadinessPanelProps = {
  data: CaseContentForQualityCheck;
};

export default function CaseReadinessPanel({
  data,
}: CaseReadinessPanelProps) {
  const readiness = evaluateCaseReadiness(data);

  return (
    <div
      className={`rounded-[2rem] border p-6 ${
        readiness.isReady
          ? "border-emerald-500/30 bg-emerald-500/10"
          : "border-amber-500/30 bg-amber-500/10"
      }`}
    >
      <div
        className={`text-xs uppercase tracking-[0.3em] ${
          readiness.isReady ? "text-emerald-400" : "text-amber-300"
        }`}
      >
        {readiness.isReady ? "Publish Ready" : "Needs Attention"}
      </div>

      <h2 className="mt-4 text-2xl font-semibold text-white">
        Editor QA
      </h2>

      {readiness.isReady ? (
        <p className="mt-4 text-sm leading-7 text-zinc-200">
          This case currently passes the readiness checks needed for publishing.
        </p>
      ) : (
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-zinc-200">
          {readiness.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
    </div>
  );
}