// Registry of compliance policy rules.

import { deepFreeze } from './freeze';
import type { EngagementContext, ParsedPolicyRuleId, PolicyRule, PolicyRuleId } from './types';

const REGISTRY: PolicyRule[] = [];
const REGISTERED_IDS = new Set<PolicyRuleId>();

const POLICY_RULE_ID_RE = /^[a-z]+\.[a-z][a-z_0-9]*@v\d+$/;

/**
 * Register a single policy rule. Throws on duplicate or malformed `policyRuleId`.
 * Modules in `policies/*.ts` call this on import (side effect).
 */
export function registerPolicyRule(rule: PolicyRule): void {
  if (!POLICY_RULE_ID_RE.test(rule.policyRuleId)) {
    throw new Error(
      `Malformed policyRuleId: '${rule.policyRuleId}'. Expected format: <jurisdiction>.<doc_namespace>@v<N>`,
    );
  }
  if (REGISTERED_IDS.has(rule.policyRuleId)) {
    throw new Error(`Duplicate policyRuleId: ${rule.policyRuleId}`);
  }
  REGISTERED_IDS.add(rule.policyRuleId);
  REGISTRY.push(deepFreeze(rule));
}

/**
 * Resolve the set of policy rules that apply to a given engagement.
 * Pure function — never reads from DB. Filters by:
 *  1. `rule.jurisdiction === ctx.jurisdiction`
 *  2. `rule.appliesIf(ctx)` returns true
 */
export function resolvePolicyRules(ctx: EngagementContext): readonly PolicyRule[] {
  return REGISTRY.filter(r => r.jurisdiction === ctx.jurisdiction && r.appliesIf(ctx));
}

/**
 * Returns the entire registry. Used by tests + the backfill script.
 */
export function listPolicyRules(): readonly PolicyRule[] {
  return REGISTRY;
}

/**
 * Parses a PolicyRuleId into stable namespace + version.
 * Throws if the input does not match the expected shape.
 */
export function parsePolicyRuleId(id: PolicyRuleId): ParsedPolicyRuleId {
  if (!POLICY_RULE_ID_RE.test(id)) {
    throw new Error(`Cannot parse policyRuleId: '${id}'`);
  }
  const m = /^(.+)@v(\d+)$/.exec(id);
  if (!m) {
    throw new Error(`Cannot parse policyRuleId: '${id}'`);
  }
  return {
    stableNamespace: m[1] as string,
    version: Number.parseInt(m[2] as string, 10),
  };
}
