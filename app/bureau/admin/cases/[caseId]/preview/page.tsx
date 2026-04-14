import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import CasePublicView from "@/components/cases/CasePublicView";

type PageProps = {
  params: Promise<{
    caseId: string;
  }>;
};

export default async function AdminCasePreviewPage({ params }: PageProps) {
  const { caseId } = await params;
  const parsedCaseId = Number(caseId);

  if (!Number.isInteger(parsedCaseId)) {
    notFound();
  }

  const caseFile = await prisma.caseFile.findUnique({
    where: { id: parsedCaseId },
  });

  if (!caseFile) {
    notFound();
  }

  return (
    <CasePublicView
      caseFile={caseFile}
      previewMode
      adminBackHref={`/bureau/admin/cases/${caseFile.id}/edit`}
    />
  );
}