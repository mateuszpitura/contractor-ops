import type { PrismaClient } from '../../src/generated/prisma/client/client.js';

const whtRates = [
  // Saudi WHT on technical services/consultancy (non-resident)
  {
    sourceCountry: 'SA',
    contractorResidency: 'GB',
    serviceType: 'technical_services',
    standardRate: 5.0,
    treatyRate: 5.0,
    treatyReference: 'Saudi-UK DTA Article 12',
    effectiveFrom: new Date('2009-01-01'),
  },
  {
    sourceCountry: 'SA',
    contractorResidency: 'DE',
    serviceType: 'technical_services',
    standardRate: 5.0,
    treatyRate: 5.0,
    treatyReference: 'Saudi-Germany DTA Article 12',
    effectiveFrom: new Date('2012-01-01'),
  },
  {
    sourceCountry: 'SA',
    contractorResidency: 'PL',
    serviceType: 'technical_services',
    standardRate: 5.0,
    treatyRate: 5.0,
    treatyReference: 'Saudi-Poland DTA Article 12',
    effectiveFrom: new Date('2012-01-01'),
  },
  {
    sourceCountry: 'SA',
    contractorResidency: 'AE',
    serviceType: 'technical_services',
    standardRate: 5.0,
    treatyRate: null,
    treatyReference: null,
    effectiveFrom: new Date('2020-01-01'),
  },
  // Management fees (20% standard)
  {
    sourceCountry: 'SA',
    contractorResidency: 'GB',
    serviceType: 'management_fees',
    standardRate: 20.0,
    treatyRate: 8.0,
    treatyReference: 'Saudi-UK DTA Article 12',
    effectiveFrom: new Date('2009-01-01'),
  },
  {
    sourceCountry: 'SA',
    contractorResidency: 'DE',
    serviceType: 'management_fees',
    standardRate: 20.0,
    treatyRate: 10.0,
    treatyReference: 'Saudi-Germany DTA Article 12',
    effectiveFrom: new Date('2012-01-01'),
  },
  {
    sourceCountry: 'SA',
    contractorResidency: 'PL',
    serviceType: 'management_fees',
    standardRate: 20.0,
    treatyRate: 10.0,
    treatyReference: 'Saudi-Poland DTA Article 12',
    effectiveFrom: new Date('2012-01-01'),
  },
  // Royalties (15% standard)
  {
    sourceCountry: 'SA',
    contractorResidency: 'GB',
    serviceType: 'royalties',
    standardRate: 15.0,
    treatyRate: 8.0,
    treatyReference: 'Saudi-UK DTA Article 12',
    effectiveFrom: new Date('2009-01-01'),
  },
  {
    sourceCountry: 'SA',
    contractorResidency: 'DE',
    serviceType: 'royalties',
    standardRate: 15.0,
    treatyRate: 10.0,
    treatyReference: 'Saudi-Germany DTA Article 12',
    effectiveFrom: new Date('2012-01-01'),
  },
  {
    // Saudi-Poland DTA reduces royalty WHT to 10% (PwC SA WHT table).
    sourceCountry: 'SA',
    contractorResidency: 'PL',
    serviceType: 'royalties',
    standardRate: 15.0,
    treatyRate: 10.0,
    treatyReference: 'Saudi-Poland DTA Article 12',
    effectiveFrom: new Date('2012-01-01'),
  },
  // Rent/equipment (5% standard, no treaty usually)
  {
    sourceCountry: 'SA',
    contractorResidency: 'GB',
    serviceType: 'rent_equipment',
    standardRate: 5.0,
    treatyRate: null,
    treatyReference: null,
    effectiveFrom: new Date('2020-01-01'),
  },
  // Default fallback for unknown residency
  {
    sourceCountry: 'SA',
    contractorResidency: 'XX',
    serviceType: 'technical_services',
    standardRate: 5.0,
    treatyRate: null,
    treatyReference: null,
    effectiveFrom: new Date('2020-01-01'),
  },
  {
    sourceCountry: 'SA',
    contractorResidency: 'XX',
    serviceType: 'management_fees',
    standardRate: 20.0,
    treatyRate: null,
    treatyReference: null,
    effectiveFrom: new Date('2020-01-01'),
  },
  {
    sourceCountry: 'SA',
    contractorResidency: 'XX',
    serviceType: 'royalties',
    standardRate: 15.0,
    treatyRate: null,
    treatyReference: null,
    effectiveFrom: new Date('2020-01-01'),
  },
  {
    sourceCountry: 'SA',
    contractorResidency: 'XX',
    serviceType: 'rent_equipment',
    standardRate: 5.0,
    treatyRate: null,
    treatyReference: null,
    effectiveFrom: new Date('2020-01-01'),
  },

  // US-source business-profits withholding for foreign contractors.
  //
  // Rates and treaty article numbers below are real but PROVISIONAL — they must
  // be verified by a US tax adviser before any production filing. Treaty
  // countries (PL/DE/GB/IE/NL) reduce to 0% on business profits not attributable
  // to a US permanent establishment / fixed base (Article 7). UAE and KSA have no
  // US income-tax treaty, so they fall to the 30% statutory rate (treatyRate
  // null), as does the 'XX' fallback for any residency without a seeded row.
  //
  // Rates are whole-number percent (30.0 / 0.0 / null) to match the SA rows and
  // the calculateWht divide-by-100 contract — never store fractions like 0.30.
  {
    sourceCountry: 'US',
    contractorResidency: 'PL',
    serviceType: 'business_profits',
    standardRate: 30.0,
    treatyRate: 0.0,
    treatyArticle: 'Article 7',
    treatyReference: 'US-Poland Income Tax Treaty (2013) Article 7 — business profits, no US PE',
    effectiveFrom: new Date('2014-01-01'),
  },
  {
    sourceCountry: 'US',
    contractorResidency: 'DE',
    serviceType: 'business_profits',
    standardRate: 30.0,
    treatyRate: 0.0,
    treatyArticle: 'Article 7',
    treatyReference: 'US-Germany Income Tax Treaty Article 7 — business profits, no US PE',
    effectiveFrom: new Date('2008-01-01'),
  },
  {
    sourceCountry: 'US',
    contractorResidency: 'GB',
    serviceType: 'business_profits',
    standardRate: 30.0,
    treatyRate: 0.0,
    treatyArticle: 'Article 7',
    treatyReference: 'US-UK Income Tax Treaty Article 7 — business profits, no US PE',
    effectiveFrom: new Date('2003-01-01'),
  },
  {
    sourceCountry: 'US',
    contractorResidency: 'IE',
    serviceType: 'business_profits',
    standardRate: 30.0,
    treatyRate: 0.0,
    treatyArticle: 'Article 7',
    treatyReference: 'US-Ireland Income Tax Treaty Article 7 — business profits, no US PE',
    effectiveFrom: new Date('1998-01-01'),
  },
  {
    sourceCountry: 'US',
    contractorResidency: 'NL',
    serviceType: 'business_profits',
    standardRate: 30.0,
    treatyRate: 0.0,
    treatyArticle: 'Article 7',
    treatyReference: 'US-Netherlands Income Tax Treaty Article 7 — business profits, no US PE',
    effectiveFrom: new Date('1994-01-01'),
  },
  {
    // UAE has no comprehensive US income-tax treaty — 30% statutory applies.
    sourceCountry: 'US',
    contractorResidency: 'AE',
    serviceType: 'business_profits',
    standardRate: 30.0,
    treatyRate: null,
    treatyArticle: null,
    treatyReference: 'No US income-tax treaty with the UAE — 30% statutory withholding',
    effectiveFrom: new Date('2014-01-01'),
  },
  {
    // KSA has no comprehensive US income-tax treaty — 30% statutory applies.
    sourceCountry: 'US',
    contractorResidency: 'SA',
    serviceType: 'business_profits',
    standardRate: 30.0,
    treatyRate: null,
    treatyArticle: null,
    treatyReference: 'No US income-tax treaty with Saudi Arabia — 30% statutory withholding',
    effectiveFrom: new Date('2014-01-01'),
  },
  {
    // Fallback for any residency without a seeded treaty row → 30% statutory.
    sourceCountry: 'US',
    contractorResidency: 'XX',
    serviceType: 'business_profits',
    standardRate: 30.0,
    treatyRate: null,
    treatyArticle: null,
    treatyReference: null,
    effectiveFrom: new Date('2014-01-01'),
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
