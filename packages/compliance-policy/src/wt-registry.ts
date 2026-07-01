// Registry of per-jurisdiction working-time limit rules.
//
// Mirrors registry.ts (module-level array + Set, deep-freeze on register,
// duplicate-key throw, pure resolve/list). One rule per jurisdiction. Feeds the
// on-entry synchronous WT check and the daily rolling-window scan. Modules in
// policies/*.ts call registerWorkingTimeLimit on import (side effect).

import { deepFreeze } from './freeze';
import type { Jurisdiction, WorkingTimeLimitRule } from './types';

const REGISTRY: WorkingTimeLimitRule[] = [];
const REGISTERED_JURISDICTIONS = new Set<Jurisdiction>();

/**
 * Register a single working-time limit rule. Throws when the jurisdiction is
 * already registered so two seed modules can never silently override one another.
 */
export function registerWorkingTimeLimit(rule: WorkingTimeLimitRule): void {
  if (REGISTERED_JURISDICTIONS.has(rule.jurisdiction)) {
    throw new Error(`Duplicate WorkingTimeLimitRule for jurisdiction: ${rule.jurisdiction}`);
  }
  REGISTERED_JURISDICTIONS.add(rule.jurisdiction);
  REGISTRY.push(deepFreeze(rule));
}

/**
 * Resolve the working-time limit rule for a jurisdiction. Pure function — never
 * reads from DB. Returns undefined when no rule is registered for the market.
 */
export function resolveWtLimits(jurisdiction: Jurisdiction): WorkingTimeLimitRule | undefined {
  return REGISTRY.find(r => r.jurisdiction === jurisdiction);
}

/** Returns the entire registry. Used by tests + the WT scan service. */
export function listWorkingTimeLimits(): readonly WorkingTimeLimitRule[] {
  return REGISTRY;
}
