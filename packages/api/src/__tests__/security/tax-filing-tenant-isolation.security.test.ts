/**
 * Cross-tenant isolation (IDOR) regression coverage for the Phase 86 US
 * year-end filing models — Wave-0 RED scaffold (D-16).
 *
 * `Form1099Nec` and `IrisSubmission` are new tenant-owning models. Per the
 * standing project rule, every new tenant-owning model gets a two-org cross-leak
 * test and is NEVER added to `globalModels`. This suite locks that a second org
 * cannot read another org's `Form1099Nec` / `IrisSubmission` rows: the staff
 * 1099 router scopes every read to the caller's organizationId, and a cross-org
 * get-by-id rejects NOT_FOUND.
 *
 * Same strategy as the sibling tenant-isolation suites: a mocked, org-scoped
 * Prisma cannot prove a real leak (it echoes the `where` it is handed), so the
 * test regression-LOCKS the presence of the org guard — the list returns only
 * the caller's rows and the findMany/findFirst `where` always carries the caller
 * organizationId.
 *
 * The router + models do not exist yet, so this suite fails at module
 * resolution — terminal-RED accepted for Wave 0.
 */

import { describe, expect, it } from 'vitest';
// The 1099/IRIS staff router surface does not exist yet — Wave-0 RED (resolution-fail).
import { createTax1099Caller } from './helpers/tax-1099-caller';

const ORG_A_ID = 'org-a-00000000-0000-0000-0000-000000000001';
const ORG_B_ID = 'org-b-00000000-0000-0000-0000-000000000002';
const FORM_A_ID = 'form-1099-a-001';
const IRIS_SUBMISSION_A_ID = 'iris-submission-a-001';

describe('tax-filing tenant isolation — Form1099Nec (D-16)', () => {
  it('orgB cannot read orgA Form1099Nec rows (cross-org get-by-id rejects NOT_FOUND)', async () => {
    const callerB = createTax1099Caller({ organizationId: ORG_B_ID });

    await expect(callerB.get1099({ id: FORM_A_ID })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('the list query is always scoped to the caller organizationId', async () => {
    const callerA = createTax1099Caller({ organizationId: ORG_A_ID });

    const { whereSeen } = await callerA.list1099({ taxYear: 2026 });

    expect(whereSeen.organizationId).toBe(ORG_A_ID);
  });
});

describe('tax-filing tenant isolation — IrisSubmission (D-16)', () => {
  it('orgB cannot read orgA IrisSubmission rows (cross-org get-by-id rejects NOT_FOUND)', async () => {
    const callerB = createTax1099Caller({ organizationId: ORG_B_ID });

    await expect(callerB.getIrisSubmission({ id: IRIS_SUBMISSION_A_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
