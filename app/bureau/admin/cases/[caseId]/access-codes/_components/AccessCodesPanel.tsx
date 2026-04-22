"use client";

import { useState } from "react";
import CreateAccessCodeForm from "./CreateAccessCodeForm";
import AccessCodeList from "./AccessCodeList";

export type AccessCodeWithCount = {
  id: number;
  code: string;
  kind: string;
  unlocksTarget: unknown;
  requiresStage: number | null;
  oneTimePerUser: boolean;
  retiredAt: string | null;
  createdAt: string;
  redemptions: { id: number }[];
};

type Props = {
  caseId: number;
  people: { id: number; name: string }[];
  records: { id: number; title: string }[];
  hints: { id: number; title: string }[];
  initialCodes: AccessCodeWithCount[];
};

/**
 * Hoists the codes state that CreateAccessCodeForm mutates (via its
 * onCreated callback) and AccessCodeList renders. The page server-fetches
 * the initial list; after a successful create we refetch from the GET
 * endpoint so the list reflects the new row without a full page nav.
 */
export default function AccessCodesPanel({
  caseId,
  people,
  records,
  hints,
  initialCodes,
}: Props) {
  const [codes, setCodes] = useState<AccessCodeWithCount[]>(initialCodes);

  async function refetch() {
    try {
      const response = await fetch(
        `/api/admin/cases/${caseId}/access-codes`,
        { cache: "no-store" }
      );
      if (!response.ok) return;
      const data = (await response.json()) as {
        codes: AccessCodeWithCount[];
      };
      setCodes(data.codes);
    } catch {
      // Swallow — the form already surfaces its own success state; a stale
      // list will reconcile on the next navigation or explicit refresh.
    }
  }

  return (
    <div className="grid gap-8">
      <CreateAccessCodeForm
        caseId={caseId}
        people={people}
        records={records}
        hints={hints}
        onCreated={refetch}
      />
      <AccessCodeList codes={codes} />
    </div>
  );
}
