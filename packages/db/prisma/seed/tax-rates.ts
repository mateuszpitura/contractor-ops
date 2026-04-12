import type { PrismaClient } from "../../generated/prisma/client/index.js";

const taxRates = [
  // Poland (PL)
  {
    countryCode: "PL",
    code: "23",
    description: "Standard rate",
    ratePercent: 23.0,
    isDefault: true,
    isReverseCharge: false,
    isExempt: false,
    effectiveFrom: new Date("2011-01-01"),
  },
  {
    countryCode: "PL",
    code: "8",
    description: "Reduced rate",
    ratePercent: 8.0,
    isDefault: false,
    isReverseCharge: false,
    isExempt: false,
    effectiveFrom: new Date("2011-01-01"),
  },
  {
    countryCode: "PL",
    code: "5",
    description: "Reduced rate",
    ratePercent: 5.0,
    isDefault: false,
    isReverseCharge: false,
    isExempt: false,
    effectiveFrom: new Date("2011-01-01"),
  },
  {
    countryCode: "PL",
    code: "0",
    description: "Zero rate",
    ratePercent: 0.0,
    isDefault: false,
    isReverseCharge: false,
    isExempt: false,
    effectiveFrom: new Date("2011-01-01"),
  },
  {
    countryCode: "PL",
    code: "ZW",
    description: "Tax exempt",
    ratePercent: 0.0,
    isDefault: false,
    isReverseCharge: false,
    isExempt: true,
    effectiveFrom: new Date("2011-01-01"),
  },
  {
    countryCode: "PL",
    code: "NP",
    description: "Not applicable",
    ratePercent: 0.0,
    isDefault: false,
    isReverseCharge: false,
    isExempt: true,
    effectiveFrom: new Date("2011-01-01"),
  },
  // UAE (AE)
  {
    countryCode: "AE",
    code: "5",
    description: "Standard rate",
    ratePercent: 5.0,
    isDefault: true,
    isReverseCharge: false,
    isExempt: false,
    effectiveFrom: new Date("2018-01-01"),
  },
  {
    countryCode: "AE",
    code: "0",
    description: "Zero rate",
    ratePercent: 0.0,
    isDefault: false,
    isReverseCharge: false,
    isExempt: false,
    effectiveFrom: new Date("2018-01-01"),
  },
  // Saudi Arabia (SA)
  {
    countryCode: "SA",
    code: "15",
    description: "Standard rate",
    ratePercent: 15.0,
    isDefault: true,
    isReverseCharge: false,
    isExempt: false,
    effectiveFrom: new Date("2020-07-01"),
  },
  {
    countryCode: "SA",
    code: "0",
    description: "Zero rate",
    ratePercent: 0.0,
    isDefault: false,
    isReverseCharge: false,
    isExempt: false,
    effectiveFrom: new Date("2020-07-01"),
  },
];

export async function seedTaxRates(prisma: PrismaClient) {
  for (const rate of taxRates) {
    await prisma.taxRate.upsert({
      where: {
        countryCode_code_effectiveFrom: {
          countryCode: rate.countryCode,
          code: rate.code,
          effectiveFrom: rate.effectiveFrom,
        },
      },
      update: { ...rate },
      create: { ...rate },
    });
  }
  console.log(`  ✓ Seeded ${taxRates.length} tax rates`);
}
