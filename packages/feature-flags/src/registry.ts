import type { FlagDefinition } from './schemas.js';

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
    description: 'Emergency disable for AI invoice parsing (Claude Vision).',
    default: true,
    category: 'kill-switch',
    jurisdiction: 'ANY',
    owner: 'ops',
  },
  // Phase 63 — UK Payments & Financial Features
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
  // Phase 62 — ZUGFeRD / XRechnung inbound e-invoice intake (EINV-02, EINV-03).
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
  // Phase 64 — Legal Compliance Hardening (LEGAL-08, LEGAL-09, LEGAL-10).
  //
  // Kill-switch for all classification features (IR35 + Scheinselbständigkeit).
  // Default: false (ship dark — classification invisible until every disclaimer
  // in packages/validators/src/legal/signoff-registry.json is APPROVED and the
  // operator explicitly enables the toggle in Unleash per org).
  //
  // The app-side evaluator (evaluator.ts) overrides even a true Unleash result
  // to false while any disclaimer has status 'PENDING' — preventing accidental
  // exposure before legal sign-off (D-10).
  'module.classification-engine': {
    key: 'module.classification-engine',
    description:
      'Classification engine (IR35 + Scheinselbständigkeit assessments, SDS generation, DRV defense bundle, economic dependency scan). Ship dark — requires all disclaimer PENDING→APPROVED before enabling per-org.',
    default: false,
    category: 'module',
    jurisdiction: 'ANY',
    owner: 'legal-platform',
  },
} as const satisfies Record<string, FlagDefinition>);

export type FlagKey = keyof typeof FLAGS;

export const FLAG_KEYS = Object.keys(FLAGS) as FlagKey[];

/**
 * Ergonomic alias for the Phase 62 inbound e-invoice intake flag. Referenced
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
