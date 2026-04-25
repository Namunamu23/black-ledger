import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
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

  if (!caseFile) {
    const historyRow = await prisma.caseSlugHistory.findUnique({
      where: { oldSlug: slug },
      include: { caseFile: { select: { slug: true } } },
    });
    if (historyRow && historyRow.caseFile.slug !== slug) {
      redirect(`/cases/${historyRow.caseFile.slug}`);
    }
    notFound();
  }

  if (!caseFile.isActive || caseFile.workflowStatus !== "PUBLISHED") {
    notFound();
  }

  return <CasePublicView caseFile={caseFile} />;
}