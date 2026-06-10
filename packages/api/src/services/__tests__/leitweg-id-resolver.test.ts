// packages/api/src/services/__tests__/leitweg-id-resolver.test.ts
//
// Resolver unit tests. Covers the resolution order plus cross-tenant
// isolation and non-default contractor rows never being returned.
//
// Strategy: pure unit test with an in-memory Map modelling the `LeitwegId`
// table; we implement only the `findFirst` behaviour the resolver consumes.
// No real Prisma client — avoids flaky DB state and keeps the test focused on
// the resolver's branching logic.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResolvedLeitwegId } from '../leitweg-id-resolver';
import { resolveLeitwegIdForInvoice } from '../leitweg-id-resolver';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_A = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const ORG_B = 'clorgbbbbbbbbbbbbbbbbbbbbbb';
const CONTRACTOR_K1 = 'clcontractorK1aaaaaaaaaaaaa';
const CONTRACT_C1 = 'clcontractC1aaaaaaaaaaaaaaa';

// ---------------------------------------------------------------------------
// In-memory LeitwegId fake
// ---------------------------------------------------------------------------

interface LeitwegIdRow {
  id: string;
  organizationId: string;
  value: string;
  contractorId: string | null;
  contractId: string | null;
  isDefaultForContractor: boolean;
}

function makeDb(rows: LeitwegIdRow[]) {
  return {
    leitwegId: {
      findFirst: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        const where = args?.where ?? {};
        for (const row of rows) {
          if ('organizationId' in where && where.organizationId !== row.organizationId) continue;
          if ('contractId' in where && where.contractId !== row.contractId) continue;
          if ('contractorId' in where && where.contractorId !== row.contractorId) continue;
          if (
            'isDefaultForContractor' in where &&
            where.isDefaultForContractor !== row.isDefaultForContractor
          )
            continue;
          return row;
        }
        return null;
      }),
    },
  };
}

function leitwegRow(overrides: Partial<LeitwegIdRow> & { id: string }): LeitwegIdRow {
  return {
    organizationId: ORG_A,
    value: '991-12345-06',
    contractorId: null,
    contractId: null,
    isDefaultForContractor: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveLeitwegIdForInvoice — D-06 resolution order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('contract override wins over contractor default (D-06 rule 1)', async () => {
    const contractRow = leitwegRow({
      id: 'lwid-contract',
      contractId: CONTRACT_C1,
      value: '991-AAAAA-11',
    });
    const contractorDefaultRow = leitwegRow({
      id: 'lwid-contractor-default',
      contractorId: CONTRACTOR_K1,
      isDefaultForContractor: true,
      value: '991-BBBBB-22',
    });
    const db = makeDb([contractRow, contractorDefaultRow]);

    const result = await resolveLeitwegIdForInvoice(db as never, ORG_A, {
      contractId: CONTRACT_C1,
      contractorId: CONTRACTOR_K1,
    });

    expect(result).toEqual<ResolvedLeitwegId>({
      value: '991-AAAAA-11',
      source: 'contract_override',
      leitwegIdRowId: 'lwid-contract',
    });
  });

  it('contractor default wins when no contract row (D-06 rule 2)', async () => {
    const contractorDefaultRow = leitwegRow({
      id: 'lwid-contractor-default',
      contractorId: CONTRACTOR_K1,
      isDefaultForContractor: true,
      value: '991-BBBBB-22',
    });
    const db = makeDb([contractorDefaultRow]);

    const result = await resolveLeitwegIdForInvoice(db as never, ORG_A, {
      contractId: CONTRACT_C1,
      contractorId: CONTRACTOR_K1,
    });

    expect(result).toEqual<ResolvedLeitwegId>({
      value: '991-BBBBB-22',
      source: 'contractor_default',
      leitwegIdRowId: 'lwid-contractor-default',
    });
  });

  it('no match returns null (D-06 rule 3 → soft-gate)', async () => {
    const db = makeDb([]);
    const result = await resolveLeitwegIdForInvoice(db as never, ORG_A, {
      contractId: CONTRACT_C1,
      contractorId: CONTRACTOR_K1,
    });
    expect(result).toBeNull();
  });

  it('cross-tenant isolation: never returns a row from a different organizationId', async () => {
    // Row exists in orgA; resolver called with orgB → must return null.
    const orgARow = leitwegRow({
      id: 'lwid-orgA-contract',
      organizationId: ORG_A,
      contractId: CONTRACT_C1,
      value: '991-AAAAA-11',
    });
    const db = makeDb([orgARow]);

    const result = await resolveLeitwegIdForInvoice(db as never, ORG_B, {
      contractId: CONTRACT_C1,
      contractorId: CONTRACTOR_K1,
    });
    expect(result).toBeNull();
  });

  it('never falls back to a non-default contractor row', async () => {
    // Contractor row exists but isDefaultForContractor=false — resolver must
    // NOT promote it to "default" even though it's the only row for K1.
    const nonDefaultRow = leitwegRow({
      id: 'lwid-contractor-non-default',
      contractorId: CONTRACTOR_K1,
      isDefaultForContractor: false,
      value: '991-CCCCC-33',
    });
    const db = makeDb([nonDefaultRow]);

    const result = await resolveLeitwegIdForInvoice(db as never, ORG_A, {
      contractId: null,
      contractorId: CONTRACTOR_K1,
    });
    expect(result).toBeNull();
  });

  it('skips contract tier when contractId is null/undefined (no phantom contract lookup)', async () => {
    // Regression guard: when contractId is missing we MUST skip tier 1 and
    // still fall through to the contractor-default tier. A buggy implementation
    // that calls findFirst with { contractId: null } would match a row with
    // null contractId (e.g. a contractor-default row with contractor-only
    // scope) — the wrong resolution.
    const contractorDefaultRow = leitwegRow({
      id: 'lwid-contractor-default',
      contractorId: CONTRACTOR_K1,
      isDefaultForContractor: true,
      value: '991-DDDDD-44',
    });
    const db = makeDb([contractorDefaultRow]);

    const result = await resolveLeitwegIdForInvoice(db as never, ORG_A, {
      contractId: null,
      contractorId: CONTRACTOR_K1,
    });

    expect(result?.source).toBe('contractor_default');
    expect(result?.leitwegIdRowId).toBe('lwid-contractor-default');
    // No contract-tier query should have been attempted.
    expect(db.leitwegId.findFirst).toHaveBeenCalledTimes(1);
  });

  it('returns null when neither contractId nor contractorId is provided', async () => {
    const db = makeDb([
      leitwegRow({
        id: 'lwid-orphan',
        contractId: CONTRACT_C1,
        value: '991-EEEEE-55',
      }),
    ]);

    const result = await resolveLeitwegIdForInvoice(db as never, ORG_A, {});
    expect(result).toBeNull();
    expect(db.leitwegId.findFirst).not.toHaveBeenCalled();
  });
});
