// packages/validators/src/legal/compl-doc-name-signoff.ts
//
// Phase 73 D-16 — derives the signoff status of a COMPL doc-name from the static
// signoff-registry.json so UI surfaces (web-vite useComplDocName) can append a
// PENDING-subscript footnote without coupling to the registry file layout.
//
// Flat-key form mirrors the D-17 parity guard:
//   policyRuleId `uk.right_to_work@v1` -> `COMPL_DOCNAME_uk_right_to_work_v1`

import rawRegistry from './signoff-registry.json' with { type: 'json' };

const registry = rawRegistry as Record<string, { status?: string }>;

/** Maps a policyRuleId to its COMPL_DOCNAME signoff-registry flat key. */
export function complDocNameSignoffKey(policyRuleId: string): string {
  return `COMPL_DOCNAME_${policyRuleId.replace(/\./g, '_').replace(/@v/g, '_v')}`;
}

/**
 * True when the doc-name's locked phrase is still awaiting legal sign-off
 * (status PENDING or no entry yet). False only when explicitly APPROVED.
 */
export function isComplDocNamePending(policyRuleId: string): boolean {
  const entry = registry[complDocNameSignoffKey(policyRuleId)];
  return entry?.status !== 'APPROVED';
}
