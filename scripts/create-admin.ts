import dotenv from "dotenv";
import { hash } from "bcryptjs";
import { prisma } from "../lib/prisma";
import { assertSafeEnv } from "../lib/assert-safe-env";

dotenv.config({ path: ".env.local" });
dotenv.config();

assertSafeEnv("create-admin");

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Please set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env.local before running the seed script."
    );
  }

  const passwordHash = await hash(password, 12);

  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: {
      passwordHash,
      role: "ADMIN",
    },
    create: {
      email: email.toLowerCase(),
      name: "Black Ledger Admin",
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log("Admin user created or updated successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });