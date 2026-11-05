import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed — Step 1 baseline. Step 2 replaces this with the real geography +
 * demo accounts seed (see COMPLETE-BUILD-GUIDE Step 2 and spec/11 §6 sources).
 */
async function main() {
  await prisma.systemCheck.upsert({
    where: { key: "schema_baseline" },
    update: {},
    create: { key: "schema_baseline", value: new Date().toISOString() },
  });
  console.log("✅ Seed complete (baseline). Geography seed lands in Step 2.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
