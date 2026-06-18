// Pending 1099/IRIS staff router implementation — specs kept as todo.
//
// Cross-tenant isolation (IDOR) regression coverage for the US year-end filing
// models. `Form1099Nec` and `IrisSubmission` are tenant-owning models. Per the
// standing project rule, every new tenant-owning model gets a two-org cross-leak
// test and is NEVER added to `globalModels`. These specs lock that a second org
// cannot read another org's `Form1099Nec` / `IrisSubmission` rows: the staff
// 1099 router scopes every read to the caller's organizationId, and a cross-org
// get-by-id rejects NOT_FOUND.
//
// Same strategy as the sibling tenant-isolation suites: a mocked, org-scoped
// Prisma cannot prove a real leak (it echoes the `where` it is handed), so the
// test regression-LOCKS the presence of the org guard — the list returns only
// the caller's rows and the findMany/findFirst `where` always carries the caller
// organizationId.
//
// The 1099/IRIS staff router surface (`./helpers/tax-1099-caller`) does not
// exist yet; specs are kept as todo until it is built.

import { describe, it } from 'vitest';

describe('tax-filing tenant isolation — Form1099Nec', () => {
  it.todo('orgB cannot read orgA Form1099Nec rows (cross-org get-by-id rejects NOT_FOUND)');

  it.todo('the list query is always scoped to the caller organizationId');
});

describe('tax-filing tenant isolation — IrisSubmission', () => {
  it.todo('orgB cannot read orgA IrisSubmission rows (cross-org get-by-id rejects NOT_FOUND)');
});
