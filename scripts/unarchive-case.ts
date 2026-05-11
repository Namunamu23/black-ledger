import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { assertSafeEnv } from "../lib/assert-safe-env";
import { prisma } from "../lib/prisma";

assertSafeEnv("unarchive-case");

const argRaw = process.argv[2];
if (!argRaw) {
  console.error("Usage: tsx scripts/unarchive-case.ts <caseId>");
  process.exit(1);
}
const CASE_ID = Number.parseInt(argRaw, 10);
if (!Number.isInteger(CASE_ID) || CASE_ID <= 0) {
  console.error(`Invalid case id: ${argRaw}`);
  process.exit(1);
}

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
