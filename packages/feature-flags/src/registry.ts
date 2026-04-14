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
} as const satisfies Record<string, FlagDefinition>);

export type FlagKey = keyof typeof FLAGS;

export const FLAG_KEYS = Object.keys(FLAGS) as FlagKey[];

export function getFlagDefinition<K extends FlagKey>(key: K): (typeof FLAGS)[K] {
  return FLAGS[key];
}
