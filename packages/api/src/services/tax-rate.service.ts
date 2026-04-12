import { prisma } from "@contractor-ops/db";
import type { TaxRateResponse, WhtCalculation, WhtServiceType } from "@contractor-ops/validators";

/**
 * Get active tax rates for a country as of a given date.
 */
export async function getTaxRatesForCountry(
  countryCode: string,
  asOfDate: Date = new Date(),
): Promise<TaxRateResponse[]> {
  const rates = await prisma.taxRate.findMany({
    where: {
      countryCode,
      effectiveFrom: { lte: asOfDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
    },
    orderBy: [{ isDefault: "desc" }, { ratePercent: "desc" }],
  });

  return rates.map((r) => ({
    id: r.id,
    countryCode: r.countryCode,
    code: r.code,
    description: r.description,
    ratePercent: Number(r.ratePercent),
    isDefault: r.isDefault,
    isReverseCharge: r.isReverseCharge,
    isExempt: r.isExempt,
  }));
}

/**
 * Validate that a vatRate code exists for the given country.
 * Used during invoice creation to replace the old hardcoded enum check.
 */
export async function validateVatRateCode(
  countryCode: string,
  code: string,
  asOfDate: Date = new Date(),
): Promise<boolean> {
  const rate = await prisma.taxRate.findFirst({
    where: {
      countryCode,
      code,
      effectiveFrom: { lte: asOfDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
    },
  });
  return rate !== null;
}

/**
 * Calculate withholding tax for a cross-border payment from a Saudi org.
 * Returns null if no WHT applicable (e.g., domestic payment or non-SA org).
 */
export async function calculateWht(
  orgCountry: string,
  contractorResidency: string,
  serviceType: WhtServiceType,
  grossAmountMinor: number,
  paymentDate: Date = new Date(),
): Promise<WhtCalculation | null> {
  // Only Saudi currently imposes WHT in our system
  if (orgCountry !== "SA") return null;
  // Domestic payments: no WHT
  if (contractorResidency === "SA") return null;

  // Look for specific treaty rate first, then fallback to XX (default)
  const rate = await prisma.withholdingTaxRate.findFirst({
    where: {
      sourceCountry: orgCountry,
      contractorResidency: { in: [contractorResidency, "XX"] },
      serviceType,
      effectiveFrom: { lte: paymentDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: paymentDate } }],
    },
    orderBy: {
      // Prefer specific country over XX fallback
      contractorResidency: "asc",
    },
  });

  if (!rate) return null;

  const treatyApplied = rate.treatyRate !== null && rate.contractorResidency !== "XX";
  const appliedRate = treatyApplied ? Number(rate.treatyRate) : Number(rate.standardRate);
  const whtAmountMinor = Math.round((grossAmountMinor * appliedRate) / 100);

  return {
    grossAmountMinor,
    whtRate: appliedRate,
    whtAmountMinor,
    netAmountMinor: grossAmountMinor - whtAmountMinor,
    treatyApplied,
    treatyReference: treatyApplied ? rate.treatyReference : null,
    rateSource: treatyApplied ? "treaty" : "standard",
  };
}
