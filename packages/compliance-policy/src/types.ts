// Type surface for the compliance policy registry.
// Runtime registry implementation lives in src/registry.ts.

export type Severity = 'BLOCKING' | 'WARNING' | 'INFO';

export type Jurisdiction = 'UK' | 'DE' | 'PL' | 'US' | 'KSA' | 'UAE';

/**
 * Stable semantic ID + monotonic version. Format: `<jurisdiction>.<doc_namespace>@v<N>`
 * Example: 'uk.right_to_work@v1', 'de.a1@v1', 'ksa.iqama@v1'
 *
 * Stable namespace = everything before `@v`. Drift detection compares stored
 * namespace against the registry's current version per stable namespace.
 */
export type PolicyRuleId = `${Lowercase<string>}.${string}@v${number}`;

/**
 * Inputs to `resolvePolicyRules` — everything the resolver needs to filter
 * the registry down to the rules that apply to a specific engagement.
 */
export interface EngagementContext {
  jurisdiction: Jurisdiction;
  /** Outcome discriminator from the classification engine (e.g., 'IR35-INSIDE'). */
  outcome: string;
  /** Engagement sector — read from ContractorAssignment if column exists; null otherwise. */
  sector: string | null;
  /** Contractor's nationality (ISO-3166-1 alpha-2) — needed for de.aufenthaltstitel conditional. */
  contractorNationality: string | null;
  /** Whether the engagement involves regulated equipment — needed for pl.udt conditional. */
  requiresRegulatedEquipment: boolean;
}

/**
 * One row in the registry. Maps a (jurisdiction, outcome, sector, …) tuple to
 * a single ContractorComplianceItem requirement.
 */
/**
 * How a contractor-uploaded document's default `expiresAt` is derived from its
 * upload date:
 *   - `fixed_days`   + `expiryDays`   → uploadDate + N days
 *   - `fixed_months` + `expiryMonths` → uploadDate + N months
 *   - `no_expiry`                     → sentinel far-future date
 */
export type ExpirySemantic = 'fixed_days' | 'fixed_months' | 'no_expiry';

export interface PolicyRule {
  policyRuleId: PolicyRuleId;
  jurisdiction: Jurisdiction;
  /** Matches the Prisma DocumentType enum literal value. */
  documentType: string;
  /** English display name; i18n covers locales. */
  displayName: string;
  severity: Severity;
  /** IANA TZ string (e.g., 'Europe/London', 'Asia/Riyadh'). */
  expiryJurisdictionTz: string;
  /** Pure predicate — applied to EngagementContext to decide if rule fires. */
  appliesIf: (ctx: EngagementContext) => boolean;
  /**
   * Best-effort draft legal text. PENDING signoff per Standing Constraint
   * (legal review DEFERRED post-deploy). Production wording flips PENDING→APPROVED
   * via individual PRs that update signoff-registry-flags.json.
   */
  draftLegalText: string;
  /**
   * Auto-fill expiry on portal upload-replacement. Optional so existing call
   * sites that do not read it stay unaffected; the registry populates it for
   * every rule (asserted by the expiry-semantic-coverage test).
   */
  expirySemantic?: ExpirySemantic;
  expiryDays?: number;
  expiryMonths?: number;
}

/**
 * Statutory leave categories. ANNUAL is the paid-vacation entitlement every
 * market defines; the rest carry per-market rules where they exist.
 */
export type LeaveKind = 'ANNUAL' | 'PARENTAL' | 'BEREAVEMENT' | 'STUDY' | 'SICK';

/**
 * Per-market statutory leave-accrual rule. Separate from PolicyRule: leave has
 * no uploaded document, expiry, or DocumentType — it maps a (jurisdiction,
 * leaveKind) to a base entitlement that scales by tenure and, optionally, the
 * employment fraction (etat). Registered on import from policies/<cc>.ts, keyed
 * on the shared Jurisdiction type.
 */
export interface LeaveAccrualRule {
  jurisdiction: Jurisdiction;
  leaveKind: LeaveKind;
  /** Statutory base entitlement in days for a full-time worker at the given tenure. */
  baseEntitlementDays: (ctx: { tenureYears: number }) => number;
  /** Whether the base entitlement scales by the employment fraction (etat). */
  proRataByEtat: boolean;
  /**
   * How unused entitlement rolls into the next year.
   *  - `maxDays` null = no explicit statutory cap on carried days.
   *  - `expiresMonthsIntoNextYear` = months after year-end the carried days lapse
   *    (e.g. PL 9 = grant by Sep 30); null = no statutory lapse deadline encoded.
   */
  carryoverPolicy: {
    maxDays: number | null;
    expiresMonthsIntoNextYear: number | null;
  };
  /**
   * Best-effort draft legal text carrying the cited statute + adviser-verify
   * annotation. PENDING sign-off per the standing legal-review constraint
   * (local-only deploy; jurisdiction legal/tax-adviser sign-off deferred).
   */
  draftLegalText: string;
}

/**
 * Per-jurisdiction working-time limit rule. Feeds the on-entry synchronous
 * check and the daily rolling-window scan. Separate from PolicyRule for the
 * same reason as LeaveAccrualRule — no document, expiry, or DocumentType.
 */
export interface WorkingTimeLimitRule {
  jurisdiction: Jurisdiction;
  /** Statutory daily norm in minutes; null where the market caps weekly only (UK). */
  maxDailyMinutes: number | null;
  /** Absolute daily ceiling in minutes above the norm; null where none exists. */
  maxDailyHardCeilingMinutes: number | null;
  /** Average weekly cap in minutes measured over `weeklyWindowWeeks`. */
  weeklyAvgMaxMinutes: number;
  /** Reference-period length in weeks the weekly average is measured across. */
  weeklyWindowWeeks: number;
  /** Whether an individual written opt-out from the weekly cap is permitted (UK). */
  weeklyOptOutAllowed: boolean;
  /** Night-work window as local hours [startHour, endHour); null where undefined. */
  nightWindow: { startHour: number; endHour: number } | null;
  /**
   * Overtime uplift percentages where a statutory premium exists.
   *  - `standardPct` = base overtime uplift on the hourly rate.
   *  - `premiumPct` = enhanced-band uplift (night / rest-day / holiday / over-norm).
   * Omitted where the market has no statutory OT premium (contract/CBA-governed).
   */
  overtimePremium?: { standardPct: number; premiumPct: number };
  /**
   * Best-effort draft legal text carrying the cited statute + adviser-verify
   * annotation. PENDING sign-off per the standing legal-review constraint.
   */
  draftLegalText: string;
}

/**
 * Parses a PolicyRuleId into its stable namespace + version.
 * Throws if the input does not match the expected shape.
 */
export interface ParsedPolicyRuleId {
  stableNamespace: string;
  version: number;
}
