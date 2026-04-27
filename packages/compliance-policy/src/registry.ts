// Phase 71 D-01 — Registry of compliance policy rules.
// Implementation lives in Plan 71-02; this file's stub exists so types compile.

import type { EngagementContext, ParsedPolicyRuleId, PolicyRule, PolicyRuleId } from './types.js';

const REGISTRY: PolicyRule[] = [];

export function registerPolicyRule(_rule: PolicyRule): void {
  // Stub — Plan 71-02 implements duplicate detection + push.
  throw new Error('registerPolicyRule not implemented (Plan 71-02)');
}

export function resolvePolicyRules(_ctx: EngagementContext): readonly PolicyRule[] {
  // Stub — Plan 71-02 implements jurisdiction + appliesIf filter.
  return [];
}

export function listPolicyRules(): readonly PolicyRule[] {
  return REGISTRY;
}

export function parsePolicyRuleId(_id: PolicyRuleId): ParsedPolicyRuleId {
  // Stub — Plan 71-02 implements regex parse.
  throw new Error('parsePolicyRuleId not implemented (Plan 71-02)');
}
