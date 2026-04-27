import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { prisma } from "../lib/prisma";

const CASE_ID = 3; // change this if needed

async function main() {
  const cases = await prisma.caseFile.findMany({
    select: { id: true, title: true, workflowStatus: true },
    orderBy: { id: "asc" },
  });

  console.log("\nAll cases:");
  cases.forEach((c) => console.log(`  [${c.id}] ${c.title} — ${c.workflowStatus}`));

  const target = cases.find((c) => c.id === CASE_ID);
  if (!target) {
    console.error(`\nNo case found with id=${CASE_ID}`);
    process.exit(1);
  }

  if (target.workflowStatus === "PUBLISHED") {
    console.log(`\nCase ${CASE_ID} is already PUBLISHED — nothing to do.`);
    process.exit(0);
  }

  const updated = await prisma.caseFile.update({
    where: { id: CASE_ID },
    data: { workflowStatus: "PUBLISHED" },
  });

  console.log(`\nDone: case ${CASE_ID} is now ${updated.workflowStatus}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
