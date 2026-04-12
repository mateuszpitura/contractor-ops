import { PrismaClient } from "../../generated/prisma/client/index.js";
import { seedTaxRates } from "./tax-rates.js";
import { seedWhtRates } from "./wht-rates.js";

const prisma = new PrismaClient();

async function main() {
  await seedTaxRates(prisma);
  await seedWhtRates(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
