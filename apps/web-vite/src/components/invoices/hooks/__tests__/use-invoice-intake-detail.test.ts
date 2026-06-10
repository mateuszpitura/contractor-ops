/**
 * Pins for `deriveIsNotFound` — the pure derivation that the intake-detail
 * container relies on to render the same in-place "not found" UI for both
 * cross-org access (server returns NOT_FOUND because the pre-filter by
 * `(id, organizationId)` returns null) and a genuinely missing intake id.
 * Both responses must look identical to the caller so the UI does not leak
 * whether the intake row exists in a different tenant.
 *
 * Counterpart contract on the server side: `invoiceIntake.getById` at
 * `packages/api/src/routers/finance/invoice-intake.ts:295-309` throws
 * `TRPCError({ code: 'NOT_FOUND' })` when the org-scoped findFirst returns
 * null. The cross-org behaviour is itself pinned by
 * `packages/api/src/routers/__tests__/invoice-intake.test.ts:444-457`.
 */

import { describe, expect, it } from 'vitest';

import { deriveIsNotFound } from '../../../../lib/derive-is-not-found.js';

describe('deriveIsNotFound', () => {
  it('returns false on a null / undefined error (happy path)', () => {
    expect(deriveIsNotFound(null)).toBe(false);
    expect(deriveIsNotFound(undefined)).toBe(false);
  });

  it('returns true on a TRPCClientError-shaped NOT_FOUND payload', () => {
    const err = { data: { code: 'NOT_FOUND' } };
    expect(deriveIsNotFound(err)).toBe(true);
  });

  it('returns false on FORBIDDEN — the procedure must NEVER throw FORBIDDEN', () => {
    // Cross-org reads must surface as NOT_FOUND so the response does not
    // leak whether the intake row exists in a different tenant. A
    // FORBIDDEN here would be a regression on the org-scoped pre-filter.
    const err = { data: { code: 'FORBIDDEN' } };
    expect(deriveIsNotFound(err)).toBe(false);
  });

  it('returns false on INTERNAL_SERVER_ERROR / other transport errors', () => {
    expect(deriveIsNotFound({ data: { code: 'INTERNAL_SERVER_ERROR' } })).toBe(false);
    expect(deriveIsNotFound({ data: { code: 'TIMEOUT' } })).toBe(false);
  });

  it('returns false when the error has no `data.code` (network failure)', () => {
    expect(deriveIsNotFound(new TypeError('NetworkError'))).toBe(false);
    expect(deriveIsNotFound({})).toBe(false);
  });
});
