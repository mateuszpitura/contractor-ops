import { prisma } from '@contractor-ops/db';

// EU member states for reverse charge mechanism
const EU_MEMBER_STATES = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
]);

// GCC member states (for future GCC reverse charge rules)
const GCC_MEMBER_STATES = new Set(['AE', 'SA', 'BH', 'KW', 'OM', 'QA']);

// ---------------------------------------------------------------------------
// §13b UStG domestic reverse-charge service types
//
// Section 13b Abs. 2 UStG lists ~12 scenarios where VAT liability shifts from
// seller to buyer for domestic DE transactions. The 5 types below cover the
// most commonly-invoiced by contractor-ops customers (software houses,
// agencies, freelancers with building clients). Expansion is deferred; the
// enum lives here (not in the DB) because it is legally specified, not
// tenant-configurable. Extending requires Steuerberater sign-off on the
// service description mapping.
// ---------------------------------------------------------------------------

export type DE13bServiceType =
  | 'CONSTRUCTION' // § 13b Abs. 2 Nr. 4 UStG — Bauleistungen
  | 'CLEANING_BUILDING' // § 13b Abs. 2 Nr. 8 UStG — Gebäudereinigung
  | 'SCRAP_METALS' // § 13b Abs. 2 Nr. 7 UStG — Altmetalle (Anlage 3)
  | 'GOLD' // § 13b Abs. 2 Nr. 9 UStG — Lieferungen von Gold
  | 'MOBILE_PHONES'; // § 13b Abs. 2 Nr. 10 UStG — Mobilfunkgeräte

export const DE_13B_SERVICE_TYPES: ReadonlySet<DE13bServiceType> = new Set<DE13bServiceType>([
  'CONSTRUCTION',
  'CLEANING_BUILDING',
  'SCRAP_METALS',
  'GOLD',
  'MOBILE_PHONES',
]);

export interface ReverseChargeResult {
  shouldApply: boolean;
  reason: string;
  rule:
    | 'eu_cross_border_b2b'
    | 'gb_eu_post_brexit_b2b' // UK ↔ EU post-Brexit (symmetric)
    | 'de_domestic_13b_ustg' // DE domestic §13b UStG
    | 'not_applicable';
}

/** Post-Brexit UK ↔ EU B2B reverse charge detection. */
function detectUkEuReverseCharge(
  sellerCountry: string,
  buyerCountry: string,
  buyerHasVatId: boolean,
): ReverseChargeResult | null {
  const isUkEuDirection =
    (sellerCountry === 'GB' && EU_MEMBER_STATES.has(buyerCountry)) ||
    (EU_MEMBER_STATES.has(sellerCountry) && buyerCountry === 'GB');
  if (!isUkEuDirection) return null;

  if (buyerHasVatId) {
    return {
      shouldApply: true,
      reason: `UK↔EU post-Brexit B2B reverse charge: ${sellerCountry} -> ${buyerCountry}`,
      rule: 'gb_eu_post_brexit_b2b',
    };
  }
  return {
    shouldApply: false,
    reason: 'UK↔EU B2B but buyer has no VAT ID - standard VAT applies',
    rule: 'not_applicable',
  };
}

/** EU cross-border B2B reverse charge detection. */
function detectEuCrossBorderReverseCharge(
  sellerCountry: string,
  buyerCountry: string,
  buyerHasVatId: boolean,
): ReverseChargeResult | null {
  const isEuCrossBorder = EU_MEMBER_STATES.has(sellerCountry) && EU_MEMBER_STATES.has(buyerCountry);
  if (!isEuCrossBorder) return null;

  if (buyerHasVatId) {
    return {
      shouldApply: true,
      reason: `EU cross-border B2B: ${sellerCountry} -> ${buyerCountry} with valid buyer VAT ID`,
      rule: 'eu_cross_border_b2b',
    };
  }
  return {
    shouldApply: false,
    reason: 'EU cross-border but buyer has no VAT ID - standard VAT applies',
    rule: 'not_applicable',
  };
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
  serviceType?: DE13bServiceType;
}): ReverseChargeResult {
  const { sellerCountry, buyerCountry, buyerHasVatId, isB2B, serviceType } = params;

  // Rule 0: Not B2B — no reverse charge regardless of jurisdiction.
  // Evaluated FIRST so the §13b + B2C edge-case short-circuits correctly.
  if (!isB2B) {
    return {
      shouldApply: false,
      reason: 'B2C transaction - reverse charge only for B2B',
      rule: 'not_applicable',
    };
  }

  // Rule 1: DE domestic §13b UStG — evaluated BEFORE the generic
  // same-country short-circuit because §13b is precisely a domestic rule.
  if (
    sellerCountry === 'DE' &&
    buyerCountry === 'DE' &&
    serviceType &&
    DE_13B_SERVICE_TYPES.has(serviceType)
  ) {
    return {
      shouldApply: true,
      reason: `§13b UStG domestic reverse charge: ${serviceType}`,
      rule: 'de_domestic_13b_ustg',
    };
  }

  // Rule 2: Same country (outside §13b) — no reverse charge.
  if (sellerCountry === buyerCountry) {
    return { shouldApply: false, reason: 'Domestic transaction', rule: 'not_applicable' };
  }

  // Rule 3: Post-Brexit UK ↔ EU B2B (symmetric). Takes precedence over the
  // generic EU-cross-border rule when GB is on either side of the
  // transaction, so audit logs surface the correct legal basis.
  const ukEuResult = detectUkEuReverseCharge(sellerCountry, buyerCountry, buyerHasVatId);
  if (ukEuResult) return ukEuResult;

  // Rules 4-5: EU cross-border B2B.
  const euResult = detectEuCrossBorderReverseCharge(sellerCountry, buyerCountry, buyerHasVatId);
  if (euResult) return euResult;

  // GCC: No standardized reverse charge between GCC states yet.
  if (GCC_MEMBER_STATES.has(sellerCountry) && GCC_MEMBER_STATES.has(buyerCountry)) {
    return {
      shouldApply: false,
      reason: 'GCC cross-border - no standardized reverse charge mechanism',
      rule: 'not_applicable',
    };
  }

  // Default: no reverse charge.
  return {
    shouldApply: false,
    reason: 'No applicable reverse charge rule',
    rule: 'not_applicable',
  };
}

/**
 * Pure override-precedence decision shared by every reverse-charge call site.
 *
 * Given the auto-detected outcome and an explicit user override, returns the
 * final flag plus the auto-detected value (the latter feeds the
 * override-with-reason audit). A set override (true/false) always wins; an
 * unset override (null/undefined) defers to auto-detection. No DB, no I/O.
 */
export function resolveReverseChargeDecision(
  autoDetected: boolean,
  override: boolean | null | undefined,
): { isReverseCharge: boolean; autoDetected: boolean } {
  if (override === true) return { isReverseCharge: true, autoDetected };
  if (override === false) return { isReverseCharge: false, autoDetected };
  return { isReverseCharge: autoDetected, autoDetected };
}

/**
 * Apply reverse charge logic to an invoice, respecting manual override.
 * If reverseChargeOverride is set, use it. Otherwise, auto-detect.
 */
export async function applyReverseCharge(params: {
  organizationId: string;
  contractorId: string;
  reverseChargeOverride?: boolean | null;
  /**
   * Optional §13b UStG service classification.
   * When set AND jurisdiction=DE→DE, triggers domestic reverse charge.
   */
  serviceType?: DE13bServiceType;
}): Promise<{ isReverseCharge: boolean; reason: string }> {
  const { organizationId, contractorId, reverseChargeOverride, serviceType } = params;

  // Manual override takes precedence — short-circuit before any DB load.
  if (reverseChargeOverride !== undefined && reverseChargeOverride !== null) {
    const { isReverseCharge } = resolveReverseChargeDecision(false, reverseChargeOverride);
    return {
      isReverseCharge,
      reason: reverseChargeOverride
        ? 'Manually set to reverse charge'
        : 'Manually removed reverse charge',
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
    return { isReverseCharge: false, reason: 'Organization has no country set' };
  }

  const result = detectReverseCharge({
    sellerCountry: contractor.countryCode,
    buyerCountry: org.countryCode,
    buyerHasVatId: !!contractor.vatId,
    isB2B: contractor.type === 'COMPANY' || contractor.type === 'SOLE_TRADER',
    serviceType,
  });

  const { isReverseCharge } = resolveReverseChargeDecision(
    result.shouldApply,
    reverseChargeOverride,
  );
  return { isReverseCharge, reason: result.reason };
}
