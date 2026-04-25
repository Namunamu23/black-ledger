import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import CasePublicView from "@/components/cases/CasePublicView";
import { getOptionalSession } from "@/lib/auth-helpers";

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

  const session = await getOptionalSession();
  const userId = Number(session?.user?.id);
  let alreadyOwns = false;
  if (Number.isInteger(userId)) {
    const ownership = await prisma.userCase.findUnique({
      where: { userId_caseFileId: { userId, caseFileId: caseFile.id } },
      select: { id: true },
    });
    alreadyOwns = ownership !== null;
  }

  return <CasePublicView caseFile={caseFile} canBuy={!alreadyOwns} />;
}