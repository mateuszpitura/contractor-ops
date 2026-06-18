/**
 * Models in this list are exempt from the `lint:schema` `organizationId`
 * requirement. Each entry is one of:
 *   - a global lookup table with no per-tenant data (Country, Currency, …),
 *   - an auth-identity model that pre-dates the tenant scope (User, Session,
 *     Account, Verification — Better Auth schema),
 *   - the tenant root itself (Organization),
 *   - a system/dedup record outside the tenant boundary (StripeEvent,
 *     CronScanState, NotificationCronDedup, …).
 *
 * RULES (enforced by the guard at parse time):
 *   1. Every entry MUST have a `// reason: <text>` comment on the same line.
 *   2. Adding to this list requires PR review (typed `as const satisfies` —
 *      tsc fails when an entry is removed but still referenced anywhere).
 */
export const GLOBAL_LOOKUP_MODELS_ALLOWLIST = [
  // ── Global reference data (no tenant scope) ────────────────────────────
  'ExchangeRate', // reason: per-day FX rate published once per day, not tenant-scoped
  'BoEBaseRateHistory', // reason: Bank of England base-rate timeline — global reference
  'TaxRate', // reason: jurisdictional tax-rate lookup — global reference
  'WithholdingTaxRate', // reason: jurisdictional withholding-tax lookup — global reference
  'UaeFreeZone', // reason: global seed of UAE free zones (code + authority-name key); non-PII lookup, no tenant scope
  'Tax1099Threshold', // reason: tax-year-keyed federal 1099-NEC reporting threshold — global IRS reference, not tenant-scoped
  'StateFilingConfig', // reason: per-state Combined Federal/State Filing config keyed by state+year — global reference, not tenant-scoped

  // ── Tenant root (cannot reference itself) ──────────────────────────────
  'Organization', // reason: the tenant itself; organizationId points back to id

  // ── Auth identity (Better Auth, pre-tenant scope) ──────────────────────
  'User', // reason: identity model — users span organizations via membership
  'Session', // reason: auth session keyed by userId, scoped via user→org relation
  'Account', // reason: OAuth account record keyed by userId
  'Verification', // reason: short-lived email/2FA challenge keyed by identifier
  'UserPinnedView', // reason: user-keyed UI preference (pinned views), scoped via user→org relation like Session/Account

  // ── System / cron / dedup records (outside tenant boundary) ────────────
  'StripeEvent', // reason: webhook idempotency table keyed by event id — global
  'CronScanState', // reason: cron-job watermark keyed by job name — global
  'NotificationCronDedup', // reason: cron-dedup keyed by notification id — global
  'PortalMagicToken', // reason: short-lived contractor-portal token; scoped via contractorId relation

  // ── Junction / relation tables (scoped via parent FK) ──────────────────
  'ContractorTagLink', // reason: M:N join row; scoped via contractorId+tagId parents which are tenant-scoped
  'SigningRecipient', // reason: child row of SigningEnvelope; tenant scope via envelope FK
] as const satisfies readonly string[];

export type GlobalLookupModel = (typeof GLOBAL_LOOKUP_MODELS_ALLOWLIST)[number];
