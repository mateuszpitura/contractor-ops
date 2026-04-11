import { PrismaClient } from "../../generated/prisma/client/index.js";
import { seedTaxRates } from "./tax-rates.js";
import { seedWhtRates } from "./wht-rates.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");
  await seedTaxRates(prisma);
  await seedWhtRates(prisma);
  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
