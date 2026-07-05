/**
 * Wave-0 RED contract (INTEG-API-01, IDOR) — cross-tenant isolation for the
 * net-new public read/write model families that `../tenant-isolation.test.ts`
 * and `../../../__tests__/security/tenant-isolation-extra.security.test.ts` do
 * not yet cover: payment, paymentRun, workflow, workflowTask, classification,
 * complianceDocument (document), auditLog.
 *
 * Same idiom as `tenant-isolation-extra.security.test.ts`: mock `@contractor-ops/db`
 * with an in-memory org-scoped collection, seed rowA(ORG_A) + rowB(ORG_B), drive
 * a public read/mutate of rowB under an ORG_A api-key, and assert null / P2025
 * and that the injected `where` carries `organizationId: ORG_A`.
 *
 * RED until 98-08 (reads) + 98-09 (writes) add these sub-routers. Terminal
 * Cannot-find-module on the not-yet-existing `../payment` sub-router is the
 * accepted Wave-0 state; 98-08 fills the cross-org assertions per family.
 */

import { describe, expect, it } from 'vitest';
import { publicAuditRouter } from '../audit';
// RED: the net-new public sub-routers do not exist yet (added in 98-08 / 98-09).
import { publicPaymentRouter } from '../payment';
import { publicWorkflowRouter } from '../workflow';

const NEW_FAMILIES = [
  'payment',
  'paymentRun',
  'workflow',
  'workflowTask',
  'classification',
  'complianceDocument',
  'auditLog',
] as const;

describe.skip('public net-new families cross-tenant isolation (HOLD-until-98-08)', () => {
  it.each(NEW_FAMILIES)('%s: rowB under an ORG_A key resolves null / injected ORG_A where', () => {
    // Filled by 98-08: seed rowA(ORG_A)+rowB(ORG_B), read/mutate rowB under an
    // ORG_A api-key caller, assert null / P2025 + where.organizationId === ORG_A.
    expect(publicPaymentRouter).toBeDefined();
    expect(publicWorkflowRouter).toBeDefined();
    expect(publicAuditRouter).toBeDefined();
  });
});
