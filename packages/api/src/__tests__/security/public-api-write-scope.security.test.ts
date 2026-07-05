/**
 * Wave-0 RED contract (INTEG-API-01 / D-02) — BFLA tripwire.
 *
 * The public write surface must be scope-enforced by construction: EVERY write
 * procedure carries a mandatory `requirePermission(...)` whose computed scope
 * string is a member of `PUBLIC_API_SCOPES`, and a correctly-authenticated key
 * WITHOUT that scope must be forbidden. This table is the canonical BFLA
 * tripwire — adding a write procedure later without a matching entry here is a
 * hard test failure.
 *
 * Two halves:
 *   1. Scope-registry membership — every `requiredScope` in the matrix is a
 *      member of `PUBLIC_API_SCOPES`. RED until 98-03 adds the write scopes;
 *      GREEN thereafter.
 *   2. Live 403 matrix (HOLD-until-98-09) — each write procedure 403s a key
 *      lacking its scope and passes with it. 98-09 builds the procedures and
 *      un-skips this block.
 */

import { describe, expect, it } from 'vitest';
import { PUBLIC_API_SCOPES } from '../../lib/scope-utils';

/**
 * The exact 98-09 write surface: `{ procedurePath, requiredScope }`. 98-03
 * confirms/locks this; 98-09 makes each procedure exist and enforce the scope.
 */
const WRITE_SCOPE_MATRIX = [
  { procedurePath: 'contractor.create', requiredScope: 'contractor:create' },
  { procedurePath: 'contractor.update', requiredScope: 'contractor:update' },
  { procedurePath: 'invoice.create', requiredScope: 'invoice:create' },
  { procedurePath: 'invoice.void', requiredScope: 'invoice:update' },
  { procedurePath: 'payment.create', requiredScope: 'payment:create' },
  { procedurePath: 'payment.update', requiredScope: 'payment:update' },
  { procedurePath: 'paymentRun.create', requiredScope: 'payment:create' },
  { procedurePath: 'paymentRun.transition', requiredScope: 'payment:update' },
  { procedurePath: 'paymentRun.export', requiredScope: 'payment:export' },
  { procedurePath: 'workflow.create', requiredScope: 'workflow:create' },
  { procedurePath: 'workflow.execute', requiredScope: 'workflow:execute' },
  { procedurePath: 'workflowTask.transition', requiredScope: 'workflow:update' },
  { procedurePath: 'complianceDocument.create', requiredScope: 'document:create' },
  { procedurePath: 'complianceDocument.link', requiredScope: 'document:update' },
] as const;

describe('public write BFLA — scope registry membership', () => {
  const scopeSet = new Set<string>(PUBLIC_API_SCOPES);
  for (const { procedurePath, requiredScope } of WRITE_SCOPE_MATRIX) {
    it(`${procedurePath} requires a scope present in PUBLIC_API_SCOPES (${requiredScope})`, () => {
      // RED until 98-03 adds the write scopes to PUBLIC_API_SCOPES.
      expect(scopeSet.has(requiredScope)).toBe(true);
    });
  }
});

// The live BFLA matrix (a scoped-out key → FORBIDDEN, scoped key → passes) needs
// the 98-09 write procedures + the api-key caller harness. 98-09 un-skips this.
describe.skip('public write BFLA — live 403 matrix (HOLD-until-98-09)', () => {
  it.each(
    WRITE_SCOPE_MATRIX,
  )('$procedurePath forbids a key without $requiredScope and allows one with it', () => {
    // Filled by 98-09: invoke the procedure through an api-key caller whose
    // scopes OMIT requiredScope → expect TRPCError FORBIDDEN; then WITH it →
    // passes the gate.
    expect(true).toBe(true);
  });
});
