"use client";

type Props = { caseId: number };

/**
 * Triggers a native browser download of the codes CSV. The link points
 * directly at the GET endpoint with ?format=csv; the server sets
 * Content-Disposition: attachment so the browser saves it without
 * needing JS to assemble the blob.
 */
export default function ExportCsvButton({ caseId }: Props) {
  return (
    <a
      href={`/api/admin/cases/${caseId}/codes?format=csv`}
      download
      className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-950"
    >
      Export CSV
    </a>
  );
}
