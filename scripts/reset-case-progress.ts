import dotenv from "dotenv";
import { prisma } from "../lib/prisma";

dotenv.config({ path: ".env.local" });
dotenv.config();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const slug = "alder-street-review";

  if (!email) {
    throw new Error("SEED_ADMIN_EMAIL is not set in .env.local");
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error(`User not found for email: ${email}`);
  }

  const caseFile = await prisma.caseFile.findUnique({
    where: { slug },
  });

  if (!caseFile) {
    throw new Error(`Case not found for slug: ${slug}`);
  }

  await prisma.$transaction([
    prisma.checkpointAttempt.deleteMany({
      where: {
        userId: user.id,
        caseFileId: caseFile.id,
      },
    }),
    prisma.theorySubmission.deleteMany({
      where: {
        userId: user.id,
        caseFileId: caseFile.id,
      },
    }),
    prisma.userCase.updateMany({
      where: {
        userId: user.id,
        caseFileId: caseFile.id,
      },
      data: {
        currentStage: 1,
        status: "ACTIVE",
        firstOpenedAt: null,
        lastViewedAt: null,
        completedAt: null,
      },
    }),
  ]);

  console.log(`Progress reset for ${email} on case "${slug}".`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });