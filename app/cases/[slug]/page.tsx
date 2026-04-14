import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import CasePublicView from "@/components/cases/CasePublicView";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function PublicCasePage({ params }: PageProps) {
  const { slug } = await params;

  const caseFile = await prisma.caseFile.findUnique({
    where: { slug },
  });

  if (!caseFile || !caseFile.isActive || caseFile.workflowStatus !== "PUBLISHED") {
    notFound();
  }

  return <CasePublicView caseFile={caseFile} />;
}