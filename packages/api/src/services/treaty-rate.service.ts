import { prisma } from '@contractor-ops/db';
import { TRPCError } from '@trpc/server';
import { TREATY_OVERRIDE_REASON_REQUIRED } from '../errors';

// ---------------------------------------------------------------------------
// US treaty-rate resolution service.
//
// A parallel resolution path to `tax-rate.service.ts` `calculateWht` — it does
// NOT touch that function. `calculateWht` is hard-gated to SA orgs and computes
// an actual withholding amount; this service resolves the US treaty *claim*
// (rate + article) for a W-8BEN/W-8BEN-E, defaulting to the 30% statutory rate
// when no treaty row applies.
//
// The override-precedence shape mirrors `reverse-charge.service.ts`
// (`resolveReverseChargeDecision`): a pure decision function plus a DB-loading
// `applyTreaty`. A manual override requires a non-empty reason and wins over the
// auto-detected rate; the caller (portal/staff router) writes the audit log when
// `auditRequired` is true. The auto-detected value is resolved from the table
// even under an override so the audit captures what was overridden.
//
// LOCAL-ONLY: the seeded treaty rates/articles are adviser-deferred provisional
// values (annotated in the wht-rates seed). The actual withholding is deferred
// to the 1042-S filing phase; this service only captures the claim.
// ---------------------------------------------------------------------------

/** Statutory US withholding rate (percent) applied when no treaty reduces it. */
const STATUTORY_RATE = 30;

/** US source-country rows resolve on the business-profits income axis. */
const US_INCOME_TYPE = 'business_profits';

export type TreatyRateSource = 'treaty' | 'override' | 'statutory_30';

export interface TreatyDecision {
  /** Resolved withholding rate in whole-number percent. */
  rate: number;
  /** Resolved structured treaty article (null when statutory / not claimed). */
  article: string | null;
  source: TreatyRateSource;
  /** True when a treaty row supplied the auto-detected rate. */
  autoDetected: boolean;
  /** True on the override branch — the caller must write an audit log. */
  auditRequired: boolean;
  /** Auto-detected rate, preserved alongside an override for the audit trail. */
  autoRate: number | null;
  /** Auto-detected article, preserved alongside an override for the audit trail. */
  autoArticle: string | null;
}

export interface ResolveTreatyInput {
  /** Auto-detected treaty rate (null when no treaty row matched). */
  autoRate: number | null;
  /** Auto-detected treaty article (null when no treaty row matched). */
  autoArticle: string | null;
  /** Whether a treaty row was found for the residency/income pair. */
  hasTreatyRow: boolean;
  /** Manual override rate (percent). When set, requires a reason. */
  overrideRate?: number | null;
  /** Manual override article. */
  overrideArticle?: string | null;
  /** Reason for the override — required and non-empty when an override is set. */
  overrideReason?: string | null;
}

/**
 * Pure override-precedence decision shared by every treaty-rate call site.
 *
 * A set override (a numeric rate) wins and requires a non-empty reason — the
 * override branch flags `auditRequired` so the caller persists the change.
 * Otherwise the auto-detected treaty rate applies; absent a treaty row it
 * defaults to the 30% statutory rate. No DB, no I/O.
 *
 * @throws TRPCError BAD_REQUEST when an override rate is supplied without a
 *   non-empty reason — a structured error so the caller surfaces a 400, not a 500.
 */
export function resolveTreatyDecision(input: ResolveTreatyInput): TreatyDecision {
  const { autoRate, autoArticle, hasTreatyRow, overrideRate, overrideArticle, overrideReason } =
    input;

  const hasOverrideRate = overrideRate !== undefined && overrideRate !== null;

  if (hasOverrideRate) {
    if (!overrideReason || overrideReason.trim().length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: TREATY_OVERRIDE_REASON_REQUIRED,
      });
    }
    return {
      rate: overrideRate,
      article: overrideArticle ?? null,
      source: 'override',
      autoDetected: hasTreatyRow,
      auditRequired: true,
      autoRate,
      autoArticle,
    };
  }

  if (hasTreatyRow && autoRate !== null) {
    return {
      rate: autoRate,
      article: autoArticle,
      source: 'treaty',
      autoDetected: true,
      auditRequired: false,
      autoRate,
      autoArticle,
    };
  }

  // No treaty reduction (no row, or the matched row carries a null treaty rate).
  return {
    rate: STATUTORY_RATE,
    article: null,
    source: 'statutory_30',
    autoDetected: false,
    auditRequired: false,
    autoRate,
    autoArticle,
  };
}

export interface ApplyTreatyOverride {
  rate: number;
  article?: string | null;
  reason: string;
}

export interface ApplyTreatyInput {
  /** Contractor's residency country (ISO-2). */
  contractorResidency: string;
  /** Resolution date for the temporal treaty window (defaults to now). */
  asOf?: Date;
  /** Manual override — wins over the auto-detected rate (requires a reason). */
  override?: ApplyTreatyOverride | null;
}

/**
 * Resolve the US treaty rate + article for a contractor's residency.
 *
 * Mirrors the `calculateWht` lookup (specific residency first, then the 'XX'
 * fallback) but scoped to `sourceCountry='US'` + the business-profits income
 * axis, additionally reading the structured `treatyArticle` column for the
 * W-8BEN line-10 / W-8BEN-E line-15 auto-populate. A row whose `treatyRate` is
 * null (the statutory / no-treaty case, e.g. AE/SA/XX) resolves to the 30%
 * statutory default. A manual override (with reason) wins over the resolved
 * rate while the auto-detected value is preserved for the audit trail.
 */
export async function applyTreaty(input: ApplyTreatyInput): Promise<TreatyDecision> {
  const { contractorResidency, asOf = new Date(), override } = input;

  // Specificity is resolved by two deterministic queries, not by a lexicographic
  // sort: an `orderBy contractorResidency: 'asc'` would return the 'XX' fallback
  // ahead of any country code sorting after 'XX' (e.g. 'ZA', 'ZW'), silently
  // dropping a real treaty. Query the exact residency first, then fall back to
  // the 'XX' row only when no specific row matches the temporal window.
  const baseWhere = {
    sourceCountry: 'US',
    serviceType: US_INCOME_TYPE,
    effectiveFrom: { lte: asOf },
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
  };

  const specificRow = await prisma.withholdingTaxRate.findFirst({
    where: { ...baseWhere, contractorResidency },
  });

  const row =
    specificRow ??
    (await prisma.withholdingTaxRate.findFirst({
      where: { ...baseWhere, contractorResidency: 'XX' },
    }));

  // A treaty reduction applies only when a non-XX row carries a treaty rate;
  // an 'XX' fallback or a null treaty rate is the 30% statutory default.
  const hasTreatyRow = row !== null && row.treatyRate !== null && row.contractorResidency !== 'XX';

  // Always resolve the auto-detected value first so an override carries it
  // alongside for the audit trail (what was overridden).
  return resolveTreatyDecision({
    autoRate: hasTreatyRow ? Number(row.treatyRate) : null,
    autoArticle: hasTreatyRow ? (row.treatyArticle ?? null) : null,
    hasTreatyRow,
    overrideRate: override?.rate,
    overrideArticle: override?.article ?? null,
    overrideReason: override?.reason,
  });
}
