// Phase 71 D-01 D-02 — Type surface for the compliance policy registry.
// Runtime registry implementation lives in src/registry.ts (Plan 71-02).

export type Severity = 'BLOCKING' | 'WARNING' | 'INFO';

export type Jurisdiction = 'UK' | 'DE' | 'PL' | 'US' | 'KSA' | 'UAE';

/**
 * Stable semantic ID + monotonic version. Format: `<jurisdiction>.<doc_namespace>@v<N>`
 * Example: 'uk.right_to_work@v1', 'de.a1@v1', 'ksa.iqama@v1'
 *
 * Stable namespace = everything before `@v`. Drift detection (D-09) compares
 * stored namespace against registry's current version per stable namespace.
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
 * Phase 73 D-07 — how a contractor-uploaded document's default `expiresAt` is
 * derived from its upload date:
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
  /** English display name; Phase 73 i18n covers locales. */
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
   * Phase 73 D-07 — auto-fill expiry on portal upload-replacement. Optional so
   * existing call sites that do not read it stay unaffected; the registry
   * populates it for every rule (asserted by the expiry-semantic-coverage test).
   */
  expirySemantic?: ExpirySemantic;
  expiryDays?: number;
  expiryMonths?: number;
}

/**
 * Parses a PolicyRuleId into its stable namespace + version.
 * Throws if the input does not match the expected shape.
 */
export interface ParsedPolicyRuleId {
  stableNamespace: string;
  version: number;
}
