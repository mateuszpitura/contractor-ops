// Deterministic idempotency hash for the HRIS pull.
//
// The pull hashes each record's writable projection and compares it against the
// stored hash in `IntegrationConnection.configJson`; an unchanged snapshot
// hashes equal, so the write is skipped (no `updatedAt` churn, no spurious
// event). The hash is key-order-independent so equal patches hash equal
// regardless of the provider's attribute order.

import { createHash } from 'node:crypto';

import type { HrisWritableEmployeePatch } from './field-partition';

/**
 * Which side last wrote a field. Passed to the apply-patch write path so audit
 * + future guards can reason about the change origin. The pull always tags
 * `HRIS_PULL`; CO-owned writes are `CONTRACTOR_OPS`.
 */
export type ChangeOrigin = 'HRIS_PULL' | 'CONTRACTOR_OPS';

/**
 * Recursively serialize a value with stable (sorted) key order so two
 * structurally-equal objects produce byte-identical output regardless of the
 * order their keys were inserted.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      key => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
    );
  return `{${entries.join(',')}}`;
}

/**
 * SHA-256 of the writable projection with stable key ordering. Equal patches
 * hash equal; any changed value changes the hash. An empty patch hashes stably.
 */
export function syncHash(patch: HrisWritableEmployeePatch): string {
  return createHash('sha256').update(stableStringify(patch)).digest('hex');
}
