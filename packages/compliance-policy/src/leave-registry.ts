// Registry of per-market statutory leave-accrual rules.
//
// Mirrors registry.ts (module-level array + Set, deep-freeze on register,
// duplicate-key throw, pure resolve/list). Kept separate from the PolicyRule
// registry because leave entitlement has no uploaded document or expiry — only
// a (jurisdiction, leaveKind) → tenure-scaled base entitlement. Modules in
// policies/*.ts call registerLeaveAccrualRule on import (side effect).

import { deepFreeze } from './freeze';
import type { Jurisdiction, LeaveAccrualRule, LeaveKind } from './types';

const REGISTRY: LeaveAccrualRule[] = [];
const REGISTERED_KEYS = new Set<string>();

function leaveKey(jurisdiction: Jurisdiction, leaveKind: LeaveKind): string {
  return `${jurisdiction}:${leaveKind}`;
}

/**
 * Register a single leave-accrual rule. Throws on a duplicate
 * (jurisdiction, leaveKind) pair so two seed modules can never silently
 * override one another.
 */
export function registerLeaveAccrualRule(rule: LeaveAccrualRule): void {
  const key = leaveKey(rule.jurisdiction, rule.leaveKind);
  if (REGISTERED_KEYS.has(key)) {
    throw new Error(`Duplicate LeaveAccrualRule: ${key}`);
  }
  REGISTERED_KEYS.add(key);
  REGISTRY.push(deepFreeze(rule));
}

/**
 * Resolve the leave-accrual rule for a (jurisdiction, leaveKind). Pure function —
 * never reads from DB. Returns undefined when the market defines no statutory
 * rule for that leave kind, so the caller can fall back to org policy.
 */
export function resolveLeaveAccrual(
  jurisdiction: Jurisdiction,
  leaveKind: LeaveKind,
): LeaveAccrualRule | undefined {
  return REGISTRY.find(r => r.jurisdiction === jurisdiction && r.leaveKind === leaveKind);
}

/** Returns the entire registry. Used by tests + the balance service. */
export function listLeaveAccrualRules(): readonly LeaveAccrualRule[] {
  return REGISTRY;
}
