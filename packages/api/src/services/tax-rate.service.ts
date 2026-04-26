import type { Prisma } from '@contractor-ops/db';
import { prisma } from '@contractor-ops/db';
import type { TaxRateResponse, WhtCalculation, WhtServiceType } from '@contractor-ops/validators';

type TaxRateDb = {
  taxRate: {
    findFirst: (args: Prisma.TaxRateFindFirstArgs) => Promise<{ code: string } | null>;
  };
};

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
    orderBy: [{ isDefault: 'desc' }, { ratePercent: 'desc' }],
  });

  return rates.map(r => ({
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
 * Phase 57 · Plan 04 — returns the `isDefault: true` VAT rate code for a
 * country (e.g. GB → '20', DE → '19'). Used by invoice-line creation to
 * pre-select the standard rate when the client omits `vatRate` (D-10).
 *
 * Falls back to any active zero rate if the seed lacks a default row (defensive
 * — should never happen with the Plan 57-01 seed but keeps the pipeline from
 * crashing on misconfiguration). Returns null only when no active rate exists
 * at all for the country.
 */
export async function getDefaultRateCode(
  countryCode: string,
  // Accept a Prisma client for dependency injection in tests; defaults to the
  // shared instance for production callers.
  db: TaxRateDb = prisma,
  asOfDate: Date = new Date(),
): Promise<string | null> {
  const rate = await db.taxRate.findFirst({
    where: {
      countryCode,
      isDefault: true,
      effectiveFrom: { lte: asOfDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
    },
    select: { code: true },
  });
  if (rate) return rate.code;

  // Defensive fallback — find any active zero rate for this country.
  const fallback = await db.taxRate.findFirst({
    where: {
      countryCode,
      ratePercent: 0,
      effectiveFrom: { lte: asOfDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
    },
    select: { code: true },
  });
  return fallback?.code ?? null;
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
  if (orgCountry !== 'SA') return null;
  // Domestic payments: no WHT
  if (contractorResidency === 'SA') return null;

  // Look for specific treaty rate first, then fallback to XX (default)
  const rate = await prisma.withholdingTaxRate.findFirst({
    where: {
      sourceCountry: orgCountry,
      contractorResidency: { in: [contractorResidency, 'XX'] },
      serviceType,
      effectiveFrom: { lte: paymentDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: paymentDate } }],
    },
    orderBy: {
      // Prefer specific country over XX fallback
      contractorResidency: 'asc',
    },
  });

  if (!rate) return null;

  const treatyApplied = rate.treatyRate !== null && rate.contractorResidency !== 'XX';
  const appliedRate = treatyApplied ? Number(rate.treatyRate) : Number(rate.standardRate);
  const whtAmountMinor = Math.round((grossAmountMinor * appliedRate) / 100);

  return {
    grossAmountMinor,
    whtRate: appliedRate,
    whtAmountMinor,
    netAmountMinor: grossAmountMinor - whtAmountMinor,
    treatyApplied,
    treatyReference: treatyApplied ? rate.treatyReference : null,
    rateSource: treatyApplied ? 'treaty' : 'standard',
  };
}
