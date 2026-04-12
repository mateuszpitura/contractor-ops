import { prisma } from "@contractor-ops/db";

// EU member states for reverse charge mechanism
const EU_MEMBER_STATES = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
]);

// GCC member states (for future GCC reverse charge rules)
const GCC_MEMBER_STATES = new Set(["AE", "SA", "BH", "KW", "OM", "QA"]);

export interface ReverseChargeResult {
  shouldApply: boolean;
  reason: string;
  rule: "eu_cross_border_b2b" | "not_applicable";
}

/**
 * Determine if reverse charge should apply to an invoice.
 *
 * Rules:
 * 1. Same-country transactions: never reverse charge
 * 2. EU cross-border B2B with valid buyer VAT ID: reverse charge applies
 * 3. GCC cross-border: no standardized reverse charge yet (return false)
 * 4. All other cases: no reverse charge
 */
export function detectReverseCharge(params: {
  sellerCountry: string;
  buyerCountry: string;
  buyerHasVatId: boolean;
  isB2B: boolean;
}): ReverseChargeResult {
  const { sellerCountry, buyerCountry, buyerHasVatId, isB2B } = params;

  // Rule 1: Same country - no reverse charge
  if (sellerCountry === buyerCountry) {
    return { shouldApply: false, reason: "Domestic transaction", rule: "not_applicable" };
  }

  // Rule 2: Not B2B - no reverse charge
  if (!isB2B) {
    return {
      shouldApply: false,
      reason: "B2C transaction - reverse charge only for B2B",
      rule: "not_applicable",
    };
  }

  // Rule 3: EU cross-border B2B with valid VAT ID
  if (EU_MEMBER_STATES.has(sellerCountry) && EU_MEMBER_STATES.has(buyerCountry) && buyerHasVatId) {
    return {
      shouldApply: true,
      reason: `EU cross-border B2B: ${sellerCountry} -> ${buyerCountry} with valid buyer VAT ID`,
      rule: "eu_cross_border_b2b",
    };
  }

  // Rule 4: EU cross-border but no buyer VAT ID
  if (EU_MEMBER_STATES.has(sellerCountry) && EU_MEMBER_STATES.has(buyerCountry) && !buyerHasVatId) {
    return {
      shouldApply: false,
      reason: "EU cross-border but buyer has no VAT ID - standard VAT applies",
      rule: "not_applicable",
    };
  }

  // GCC: No standardized reverse charge between GCC states yet
  if (GCC_MEMBER_STATES.has(sellerCountry) && GCC_MEMBER_STATES.has(buyerCountry)) {
    return {
      shouldApply: false,
      reason: "GCC cross-border - no standardized reverse charge mechanism",
      rule: "not_applicable",
    };
  }

  // Default: no reverse charge
  return {
    shouldApply: false,
    reason: "No applicable reverse charge rule",
    rule: "not_applicable",
  };
}

/**
 * Apply reverse charge logic to an invoice, respecting manual override.
 * If reverseChargeOverride is set, use it. Otherwise, auto-detect.
 */
export async function applyReverseCharge(params: {
  organizationId: string;
  contractorId: string;
  reverseChargeOverride?: boolean | null;
}): Promise<{ isReverseCharge: boolean; reason: string }> {
  const { organizationId, contractorId, reverseChargeOverride } = params;

  // Manual override takes precedence
  if (reverseChargeOverride !== undefined && reverseChargeOverride !== null) {
    return {
      isReverseCharge: reverseChargeOverride,
      reason: reverseChargeOverride
        ? "Manually set to reverse charge"
        : "Manually removed reverse charge",
    };
  }

  // Auto-detect from org and contractor data
  const [org, contractor] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { countryCode: true },
    }),
    prisma.contractor.findUniqueOrThrow({
      where: { id: contractorId },
      select: { countryCode: true, vatId: true, type: true },
    }),
  ]);

  if (!org.countryCode) {
    return { isReverseCharge: false, reason: "Organization has no country set" };
  }

  const result = detectReverseCharge({
    sellerCountry: contractor.countryCode,
    buyerCountry: org.countryCode,
    buyerHasVatId: !!contractor.vatId,
    isB2B: contractor.type === "COMPANY" || contractor.type === "SOLE_TRADER",
  });

  return { isReverseCharge: result.shouldApply, reason: result.reason };
}
