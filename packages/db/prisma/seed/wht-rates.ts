import type { PrismaClient } from "../../generated/prisma/client/index.js";

const whtRates = [
  // Saudi WHT on technical services/consultancy (non-resident)
  {
    sourceCountry: "SA",
    contractorResidency: "GB",
    serviceType: "technical_services",
    standardRate: 5.0,
    treatyRate: 5.0,
    treatyReference: "Saudi-UK DTA Article 12",
    effectiveFrom: new Date("2009-01-01"),
  },
  {
    sourceCountry: "SA",
    contractorResidency: "DE",
    serviceType: "technical_services",
    standardRate: 5.0,
    treatyRate: 5.0,
    treatyReference: "Saudi-Germany DTA Article 12",
    effectiveFrom: new Date("2012-01-01"),
  },
  {
    sourceCountry: "SA",
    contractorResidency: "PL",
    serviceType: "technical_services",
    standardRate: 5.0,
    treatyRate: 5.0,
    treatyReference: "Saudi-Poland DTA Article 12",
    effectiveFrom: new Date("2012-01-01"),
  },
  {
    sourceCountry: "SA",
    contractorResidency: "AE",
    serviceType: "technical_services",
    standardRate: 5.0,
    treatyRate: null,
    treatyReference: null,
    effectiveFrom: new Date("2020-01-01"),
  },
  // Management fees (20% standard)
  {
    sourceCountry: "SA",
    contractorResidency: "GB",
    serviceType: "management_fees",
    standardRate: 20.0,
    treatyRate: 8.0,
    treatyReference: "Saudi-UK DTA Article 12",
    effectiveFrom: new Date("2009-01-01"),
  },
  {
    sourceCountry: "SA",
    contractorResidency: "DE",
    serviceType: "management_fees",
    standardRate: 20.0,
    treatyRate: 10.0,
    treatyReference: "Saudi-Germany DTA Article 12",
    effectiveFrom: new Date("2012-01-01"),
  },
  {
    sourceCountry: "SA",
    contractorResidency: "PL",
    serviceType: "management_fees",
    standardRate: 20.0,
    treatyRate: 10.0,
    treatyReference: "Saudi-Poland DTA Article 12",
    effectiveFrom: new Date("2012-01-01"),
  },
  // Royalties (15% standard)
  {
    sourceCountry: "SA",
    contractorResidency: "GB",
    serviceType: "royalties",
    standardRate: 15.0,
    treatyRate: 8.0,
    treatyReference: "Saudi-UK DTA Article 12",
    effectiveFrom: new Date("2009-01-01"),
  },
  {
    sourceCountry: "SA",
    contractorResidency: "DE",
    serviceType: "royalties",
    standardRate: 15.0,
    treatyRate: 10.0,
    treatyReference: "Saudi-Germany DTA Article 12",
    effectiveFrom: new Date("2012-01-01"),
  },
  // Rent/equipment (5% standard, no treaty usually)
  {
    sourceCountry: "SA",
    contractorResidency: "GB",
    serviceType: "rent_equipment",
    standardRate: 5.0,
    treatyRate: null,
    treatyReference: null,
    effectiveFrom: new Date("2020-01-01"),
  },
  // Default fallback for unknown residency
  {
    sourceCountry: "SA",
    contractorResidency: "XX",
    serviceType: "technical_services",
    standardRate: 5.0,
    treatyRate: null,
    treatyReference: null,
    effectiveFrom: new Date("2020-01-01"),
  },
  {
    sourceCountry: "SA",
    contractorResidency: "XX",
    serviceType: "management_fees",
    standardRate: 20.0,
    treatyRate: null,
    treatyReference: null,
    effectiveFrom: new Date("2020-01-01"),
  },
  {
    sourceCountry: "SA",
    contractorResidency: "XX",
    serviceType: "royalties",
    standardRate: 15.0,
    treatyRate: null,
    treatyReference: null,
    effectiveFrom: new Date("2020-01-01"),
  },
  {
    sourceCountry: "SA",
    contractorResidency: "XX",
    serviceType: "rent_equipment",
    standardRate: 5.0,
    treatyRate: null,
    treatyReference: null,
    effectiveFrom: new Date("2020-01-01"),
  },
];

export async function seedWhtRates(prisma: PrismaClient) {
  for (const rate of whtRates) {
    await prisma.withholdingTaxRate.upsert({
      where: {
        sourceCountry_contractorResidency_serviceType_effectiveFrom: {
          sourceCountry: rate.sourceCountry,
          contractorResidency: rate.contractorResidency,
          serviceType: rate.serviceType,
          effectiveFrom: rate.effectiveFrom,
        },
      },
      update: { ...rate },
      create: { ...rate },
    });
  }
}
