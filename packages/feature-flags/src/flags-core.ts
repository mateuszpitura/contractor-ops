/**
 * Browser-safe slice of the flag registry — declarations, key constants, and
 * the typed lookup helper. Split out of `./registry` so the SPA browser entry
 * can re-export FLAGS / FLAG_KEYS without dragging in:
 *   - `process.exit` / `process.stderr` from `assertFlagSignoffsOrExit`
 *   - The top-level Zod parse + `process.stderr.write` in
 *     `./signoff-registry-flags` (only needed by the boot-time gate)
 *
 * `./registry` re-exports everything from here, so server callers keep their
 * existing import paths.
 */

import type { FlagDefinition } from './schemas';

/**
 * Deep-freezes an object tree. Runtime complement to `as const` — prevents
 * any accidental or malicious mutation of the registry after module load.
 * `as const` only affects types; the emitted JavaScript is still a plain
 * object. Without this, a dependency could rewrite `FLAGS['…'].jurisdiction`
 * and bypass the compliance invariant at runtime.
 */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return Object.freeze(value);
}

/**
 * Source of truth for every feature flag recognized by the application.
 *
 * Contract:
 * - Every key referenced via `useFlag` / `requireFeatureFlag` / `<Feature />`
 *   MUST be declared here first. TypeScript enforces this via the `FlagKey`
 *   literal union derived below.
 * - `default` is the fallback returned when the backing Unleash instance does
 *   not know the toggle (e.g. code deployed before the toggle was created in
 *   the Unleash UI) or is unreachable. Set to `false` for ship-dark modules,
 *   `true` for kill-switches.
 * - `jurisdiction` is a hard structural constraint enforced in the evaluator
 *   BEFORE the Unleash call. An 'EU' flag can never evaluate to `true` for an
 *   ME org regardless of what Unleash returns, and vice versa. Use 'ANY' when
 *   the flag is region-agnostic.
 * - The object is deep-frozen (see {@link deepFreeze}) to make the runtime
 *   shape immutable even against a malicious dependency that tries to rewrite
 *   it after load.
 */
export const FLAGS = deepFreeze({
  'module.legal-approval': {
    key: 'module.legal-approval',
    description: 'Legal approval workflow for contracts (in development — ship dark).',
    default: false,
    category: 'module',
    jurisdiction: 'ANY',
    owner: 'legal-platform',
  },
  'integration.gulf-payments': {
    key: 'integration.gulf-payments',
    description: 'Gulf-only payment rails (Mashreq, ENBD). Structurally invisible to EU orgs.',
    default: false,
    category: 'integration',
    jurisdiction: 'ME',
    owner: 'integrations',
  },
  'integration.sepa-instant': {
    key: 'integration.sepa-instant',
    description: 'EU SEPA Instant Credit Transfer payment rail. Structurally invisible to ME orgs.',
    default: false,
    category: 'integration',
    jurisdiction: 'EU',
    owner: 'integrations',
  },
  'killswitch.ai-invoice-parser': {
    key: 'killswitch.ai-invoice-parser',
    description:
      'Emergency disable for AI invoice parsing (Claude Vision). killWhenUnknown=true so an Unleash outage forces the parser OFF instead of leaving it running on its `default: true` fallback — preserving the kill-switch invariant during incidents.',
    default: true,
    category: 'kill-switch',
    jurisdiction: 'ANY',
    owner: 'ops',
    killWhenUnknown: true,
  },
  // UK Payments & Financial Features
  'payments.bacs-enabled': {
    key: 'payments.bacs-enabled',
    description: 'BACS Standard 18 Direct Credit export for UK GBP payments',
    default: false,
    category: 'payments',
    jurisdiction: 'EU',
    owner: 'payments',
  },
  'payments.late-interest-enabled': {
    key: 'payments.late-interest-enabled',
    description: 'Statutory late payment interest per LPCDA for UK B2B invoices',
    default: false,
    category: 'payments',
    jurisdiction: 'EU',
    owner: 'payments',
  },
  'payments.skonto-enabled': {
    key: 'payments.skonto-enabled',
    description: 'Skonto early payment discount for German invoices',
    default: false,
    category: 'payments',
    jurisdiction: 'EU',
    owner: 'payments',
  },
  // ZUGFeRD / XRechnung inbound e-invoice intake.
  //
  // When enabled:
  //   - "Imports" sidebar entry is visible.
  //   - "Import e-invoice" secondary item appears on the invoices-page split-button.
  //   - /invoices/intake/* routes resolve (404 otherwise).
  //
  // Outbound ZUGFeRD PDF generation ("Download ZUGFeRD PDF" button on the
  // invoice detail e-invoice tab) is intentionally NOT gated by this flag —
  // outbound generation is available wherever Phase-61 e-invoicing is.
  //
  // Jurisdiction is EU because the entire XRechnung + ZUGFeRD surface is a
  // DE/EU public-sector invoicing requirement; ME orgs never see this flag
  // evaluate to true regardless of Unleash.
  'einvoice.import-enabled': {
    key: 'einvoice.import-enabled',
    description:
      'Inbound invoice intake: XRechnung XML + ZUGFeRD PDF upload, intake list/detail routes, and the sidebar Imports entry. Outbound ZUGFeRD PDF generation is NOT flag-gated.',
    default: false,
    category: 'module',
    jurisdiction: 'EU',
    owner: 'einvoice',
  },
  // Kill-switch for all classification features (IR35 + Scheinselbständigkeit).
  // Default: false (ship dark — classification invisible until every disclaimer
  // in packages/validators/src/legal/signoff-registry.json is APPROVED and the
  // operator explicitly enables the toggle in Unleash per org).
  //
  // The app-side evaluator (evaluator.ts) overrides even a true Unleash result
  // to false while any disclaimer has status 'PENDING' — preventing accidental
  // exposure before legal sign-off.
  'module.classification-engine': {
    key: 'module.classification-engine',
    description:
      'Classification engine (IR35 + Scheinselbständigkeit assessments, SDS generation, DRV defense bundle, economic dependency scan). Ship dark — requires all disclaimer PENDING→APPROVED before enabling per-org.',
    default: false,
    category: 'module',
    jurisdiction: 'ANY',
    owner: 'legal-platform',
  },
  // IdP deprovisioning flags, gated per provider so GWS can enable independently
  // of Slack. Both ship dark (default false); both require their signoff-registry
  // entry to flip PENDING→APPROVED before enabling per-org.
  //
  // Keys are dot-namespaced under `module.idp-deprovisioning-*` to satisfy the
  // `flagDefinitionSchema` key regex (first segment must be alphanumeric, no
  // hyphen). The signoff boot-gate prefix `module.idp-deprovisioning` (added to
  // GATED_FLAG_NAMESPACE_PREFIXES) keeps them gated; the unrelated saga-level
  // `idp-deprovisioning` signoff-registry key is untouched.
  'module.idp-deprovisioning-gws': {
    key: 'module.idp-deprovisioning-gws',
    description:
      'Google Workspace deprovisioning (suspend + OAuth-grant revoke + sign-out-all-sessions). Ship dark — gates GWS deprovisioning independently of Slack; requires signoff PENDING→APPROVED before enabling per-org.',
    default: false,
    category: 'module',
    jurisdiction: 'ANY',
    owner: 'idp-platform',
  },
  'module.idp-deprovisioning-slack': {
    key: 'module.idp-deprovisioning-slack',
    description:
      'Slack deprovisioning (session-invalidate + SCIM-deactivate, Enterprise Grid). Ship dark — gates Slack deprovisioning independently of GWS; requires signoff PENDING→APPROVED before enabling per-org.',
    default: false,
    category: 'module',
    jurisdiction: 'ANY',
    owner: 'idp-platform',
  },
  // Gulf (ME) — UAE free-zone tracking + Saudization dashboard.
  //
  // Both ship dark (default false), jurisdiction ME (structurally invisible to
  // EU orgs), and are legal-sensitive: the boot-time signoff gate requires a
  // PENDING entry (gated namespace prefix 'gulf.') so neither can be flipped to
  // APPROVED without a recorded legal-ticket sign-off. Keys use the dotted form
  // because flagDefinitionSchema requires the first segment to be alphanumeric
  // (a 'gulf-…' first segment would fail the regex).
  'gulf.free-zone-tracking': {
    key: 'gulf.free-zone-tracking',
    description:
      'UAE free-zone assignment tracking + license-expiry compliance + permitted-activity scope advisory. Ship dark — ME-only; requires signoff PENDING→APPROVED before enabling per-org.',
    default: false,
    category: 'module',
    jurisdiction: 'ME',
    owner: 'gulf-platform',
  },
  'gulf.saudization-dashboard': {
    key: 'gulf.saudization-dashboard',
    description:
      'Saudization dashboard: manual Nitaqat band + headcount entry, nationalisation rate, Qiwa-auth gap, Iqama roll-up, offboarding trajectory banner. Ship dark — ME-only; requires signoff PENDING→APPROVED before enabling per-org.',
    default: false,
    category: 'module',
    jurisdiction: 'ME',
    owner: 'gulf-platform',
  },
  // v7.0 GTM Foundation flags — all 19 keys. All ship dark (default false) and
  // region-agnostic (jurisdiction 'ANY'; US flags do NOT use a US jurisdiction —
  // jurisdiction partitions EU/ME/ANY only). Keys are dot-namespaced
  // (flagDefinitionSchema regex) and gated via the v7.0 namespace prefixes added
  // to GATED_FLAG_NAMESPACE_PREFIXES, so each requires a PENDING signoff entry
  // before boot. No v7.0 feature reads these yet; the backing Unleash toggles
  // are created in the later theme phases.
  'module.us-expansion': {
    key: 'module.us-expansion',
    description:
      'US cross-border surface (Theme A): US region, profile fields, en-US locale, tax-form intake. Ship dark — requires signoff PENDING→APPROVED before enabling per-org.',
    default: false,
    category: 'module',
    jurisdiction: 'ANY',
    owner: 'us-platform',
  },
  'module.workforce-employees': {
    key: 'module.workforce-employees',
    description:
      'Workforce / employee management (Theme B): employee registry, personnel files, leave + time tracking, on/offboarding. Ship dark — requires signoff PENDING→APPROVED before enabling per-org.',
    default: false,
    category: 'module',
    jurisdiction: 'ANY',
    owner: 'workforce-platform',
  },
  'module.public-api': {
    key: 'module.public-api',
    description:
      'Public REST API surface (Theme C): external API-key consumers. Ship dark — requires signoff PENDING→APPROVED before enabling per-org.',
    default: false,
    category: 'module',
    jurisdiction: 'ANY',
    owner: 'platform-api',
  },
  'module.outbound-webhooks': {
    key: 'module.outbound-webhooks',
    description:
      'Outbound webhooks (Theme C): event dispatch over the OutboxEvent outbox with SSRF guards. Ship dark — requires signoff PENDING→APPROVED before enabling per-org.',
    default: false,
    category: 'module',
    jurisdiction: 'ANY',
    owner: 'platform-api',
  },
  'module.iris-efile': {
    key: 'module.iris-efile',
    description:
      'IRIS A2A e-file (Theme A): IRS IRIS XML transmission for 1099/1042-S (IRIS-primary; FIRE decommissions 2026-12-31). Ship dark — requires signoff PENDING→APPROVED before enabling per-org.',
    default: false,
    category: 'module',
    jurisdiction: 'ANY',
    owner: 'us-platform',
  },
  'integration.personio-sync': {
    key: 'integration.personio-sync',
    description:
      'Personio HRIS two-way sync (Theme B). Ship dark — requires signoff PENDING→APPROVED before enabling per-org.',
    default: false,
    category: 'integration',
    jurisdiction: 'ANY',
    owner: 'integrations',
  },
  'integration.bamboohr-sync': {
    key: 'integration.bamboohr-sync',
    description:
      'BambooHR HRIS two-way sync (Theme B). Ship dark — requires signoff PENDING→APPROVED before enabling per-org.',
    default: false,
    category: 'integration',
    jurisdiction: 'ANY',
    owner: 'integrations',
  },
  'integration.marketplace-zapier': {
    key: 'integration.marketplace-zapier',
    description:
      'Zapier integration marketplace listing (Theme C). Ship dark — requires signoff PENDING→APPROVED before enabling per-org.',
    default: false,
    category: 'integration',
    jurisdiction: 'ANY',
    owner: 'integrations',
  },
  'integration.marketplace-n8n': {
    key: 'integration.marketplace-n8n',
    description:
      'n8n integration marketplace listing (Theme C). Ship dark — requires signoff PENDING→APPROVED before enabling per-org.',
    default: false,
    category: 'integration',
    jurisdiction: 'ANY',
    owner: 'integrations',
  },
  'integration.marketplace-make': {
    key: 'integration.marketplace-make',
    description:
      'Make (Integromat) integration marketplace listing (Theme C). Ship dark — requires signoff PENDING→APPROVED before enabling per-org.',
    default: false,
    category: 'integration',
    jurisdiction: 'ANY',
    owner: 'integrations',
  },
  'payments.ach-payouts': {
    key: 'payments.ach-payouts',
    description:
      'US ACH payout rail via the NACHA payment-export factory (Theme A). Ship dark — requires signoff PENDING→APPROVED before enabling per-org.',
    default: false,
    category: 'payments',
    jurisdiction: 'ANY',
    owner: 'payments',
  },
  'payroll.symfonia': {
    key: 'payroll.symfonia',
    description:
      'Symfonia (PL) payroll integration adapter (Theme B). Ship dark — requires signoff PENDING→APPROVED before enabling per-org.',
    default: false,
    category: 'payroll',
    jurisdiction: 'ANY',
    owner: 'payroll-platform',
  },
  'payroll.comarch': {
    key: 'payroll.comarch',
    description:
      'Comarch (PL) payroll integration adapter (Theme B). Ship dark — requires signoff PENDING→APPROVED before enabling per-org.',
    default: false,
    category: 'payroll',
    jurisdiction: 'ANY',
    owner: 'payroll-platform',
  },
  'payroll.enova': {
    key: 'payroll.enova',
    description:
      'enova365 (PL) payroll integration adapter (Theme B). Ship dark — requires signoff PENDING→APPROVED before enabling per-org.',
    default: false,
    category: 'payroll',
    jurisdiction: 'ANY',
    owner: 'payroll-platform',
  },
  'payroll.datev': {
    key: 'payroll.datev',
    description:
      'DATEV (DE) payroll integration adapter (Theme B). Ship dark — requires signoff PENDING→APPROVED before enabling per-org.',
    default: false,
    category: 'payroll',
    jurisdiction: 'ANY',
    owner: 'payroll-platform',
  },
  'payroll.sage-uk': {
    key: 'payroll.sage-uk',
    description:
      'Sage (UK) payroll integration adapter (Theme B). Ship dark — requires signoff PENDING→APPROVED before enabling per-org.',
    default: false,
    category: 'payroll',
    jurisdiction: 'ANY',
    owner: 'payroll-platform',
  },
  'payroll.gusto': {
    key: 'payroll.gusto',
    description:
      'Gusto (US) payroll integration adapter (Theme B). Ship dark — requires signoff PENDING→APPROVED before enabling per-org.',
    default: false,
    category: 'payroll',
    jurisdiction: 'ANY',
    owner: 'payroll-platform',
  },
  'payroll.quickbooks': {
    key: 'payroll.quickbooks',
    description:
      'QuickBooks (US) payroll integration adapter (Theme B). Ship dark — requires signoff PENDING→APPROVED before enabling per-org.',
    default: false,
    category: 'payroll',
    jurisdiction: 'ANY',
    owner: 'payroll-platform',
  },
  'payroll.adp': {
    key: 'payroll.adp',
    description:
      'ADP (US) payroll integration adapter (Theme B). Ship dark — requires signoff PENDING→APPROVED before enabling per-org.',
    default: false,
    category: 'payroll',
    jurisdiction: 'ANY',
    owner: 'payroll-platform',
  },
} as const satisfies Record<string, FlagDefinition>);

export type FlagKey = keyof typeof FLAGS;

export const FLAG_KEYS = Object.keys(FLAGS) as FlagKey[];

/**
 * The v7.0 GTM-Expansion flag cohort. The explicit, order-stable list of the
 * 19 v7.0 flags — backs the "all keys present" test
 * (`getFlagSignoff(key) !== undefined` for each) and the boot-gate assertion.
 * `satisfies readonly FlagKey[]` is a compile-time guarantee that every cohort
 * key actually exists in FLAGS (a typo or a missing FLAGS entry fails tsc here,
 * not at runtime).
 */
export const V7_FLAG_KEYS = [
  'module.us-expansion',
  'module.workforce-employees',
  'module.public-api',
  'module.outbound-webhooks',
  'module.iris-efile',
  'integration.personio-sync',
  'integration.bamboohr-sync',
  'integration.marketplace-zapier',
  'integration.marketplace-n8n',
  'integration.marketplace-make',
  'payments.ach-payouts',
  'payroll.symfonia',
  'payroll.comarch',
  'payroll.enova',
  'payroll.datev',
  'payroll.sage-uk',
  'payroll.gusto',
  'payroll.quickbooks',
  'payroll.adp',
] as const satisfies readonly FlagKey[];

/**
 * Ergonomic alias for the inbound e-invoice intake flag. Referenced
 * throughout the web app (sidebar, split-button, intake routes). Kept as a
 * typed constant — not a string literal — so renames propagate via tsc.
 *
 * The underlying flag key (`einvoice.import-enabled`) conforms to the
 * lowercase dot-namespaced kebab-case regex enforced by `flagDefinitionSchema`.
 */
export const EINVOICE_IMPORT_ENABLED = 'einvoice.import-enabled' as const satisfies FlagKey;

/**
 * Typed alias for the classification-engine kill-switch flag. Referenced
 * in layout.tsx gates, the requireClassificationFlag middleware, and the
 * cron early-return guard. Use the constant rather than the string literal
 * so renames propagate via tsc.
 */
export const CLASSIFICATION_ENGINE_FLAG = 'module.classification-engine' as const satisfies FlagKey;

export function getFlagDefinition<K extends FlagKey>(key: K): (typeof FLAGS)[K] {
  return FLAGS[key];
}
