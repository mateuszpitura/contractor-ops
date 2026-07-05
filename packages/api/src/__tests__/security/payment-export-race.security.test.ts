/**
 * Regression lock for the payment.lockAndExport double-export TOCTOU (F4).
 *
 * Two concurrent `lockAndExport` calls on the same DRAFT run must not both
 * create `PaymentExport` + `PaymentRunComplianceCheck` rows. The DRAFT/LOCKED
 * → EXPORTED transition is a guarded `updateMany`, so exactly one caller wins
 * (`count: 1`); the loser sees `count: 0` and returns the idempotent result
 * without writing any rows.
 *
 * Strategy mirrors `../tenant-isolation.test.ts`: mock `@contractor-ops/db`
 * and `@contractor-ops/auth`, drive the real `appRouter` through a caller.
 * Here the mock `paymentRun.updateMany` is the oracle — it returns `count: 1`
 * on the first transition and `count: 0` thereafter, exactly as Postgres would
 * under READ COMMITTED once one transaction has committed the status flip.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'org-00000000-0000-0000-0000-000000000001';
const USER_ID = 'user-00000000-0000-0000-0000-000000000001';
const RUN_ID = 'cm5xj9k2a0000abcd1234efga';

const { mockPrisma, exportCreate, complianceCreate, itemUpdate } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const draftRun: Rec = {
    id: 'cm5xj9k2a0000abcd1234efga',
    organizationId: 'org-00000000-0000-0000-0000-000000000001',
    runNumber: 'PR-001',
    name: 'Run',
    status: 'DRAFT',
    currency: 'PLN',
    totalMinor: 100000,
    invoiceCount: 1,
    exportFormat: null,
    exportedAt: null,
    createdByUserId: 'user-00000000-0000-0000-0000-000000000001',
    createdAt: new Date('2025-03-01'),
    items: [
      {
        id: 'item-1',
        contractorId: 'contractor-00000000-0000-0000-0000-0000000001',
        currency: 'PLN',
        amountMinor: 100000,
        status: 'PENDING',
        invoice: {
          invoiceNumber: 'INV-1',
          dueDate: new Date('2025-03-15'),
          servicePeriodStart: null,
          servicePeriodEnd: null,
        },
        contractor: { legalName: 'Acme', taxId: '1234567890' },
        billingProfile: { bankAccountMasked: '****1234', swiftBic: null, bankName: 'Bank' },
      },
    ],
  };

  /** Status is mutated by the winning updateMany so the loser's findFirst sees EXPORTED. */
  let runStatus = 'DRAFT';

  const exportCreate = vi.fn(async (a: { data: Rec }) => ({ id: 'export-1', ...a.data }));
  const complianceCreate = vi.fn(async (a: { data: Rec }) => ({ id: 'cc-1', ...a.data }));
  // Settlement-provenance write. Only the transition winner may call it; a race
  // loser must not repeat the (idempotent) update for a file it never returns.
  const itemUpdate = vi.fn(async () => ({}));

  const orgRecord: Rec = {
    id: 'org-00000000-0000-0000-0000-000000000001',
    dataRegion: 'EU',
    status: 'ACTIVE',
    name: 'Org',
    slug: 'org',
    logo: null,
    countryCode: 'PL',
  };

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn(async () => orgRecord),
      findFirst: vi.fn(async () => orgRecord),
    },
    paymentRun: {
      findFirst: vi.fn(async () => ({ ...draftRun, status: runStatus })),
      findFirstOrThrow: vi.fn(async () => ({ ...draftRun, status: runStatus })),
      // Guarded check-and-set: succeeds only while the run is still pre-export.
      updateMany: vi.fn(async (a: { where: { status?: { in?: string[] } } }) => {
        const allowed = a.where.status?.in ?? [];
        if (allowed.includes(runStatus)) {
          runStatus = 'EXPORTED';
          return { count: 1 };
        }
        return { count: 0 };
      }),
    },
    paymentRunItem: {
      findMany: vi.fn(async () => [{ currency: 'PLN' }]),
      aggregate: vi.fn(async () => ({ _sum: { amountMinor: 100000 }, _count: 1 })),
      update: itemUpdate,
    },
    paymentExport: { create: exportCreate },
    paymentRunComplianceCheck: { create: complianceCreate },
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
    __resetRunStatus: () => {
      runStatus = 'DRAFT';
    },
  };

  return { mockPrisma, exportCreate, complianceCreate, itemUpdate };
});

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: { getSession: vi.fn(), hasPermission: vi.fn().mockResolvedValue({ success: true }) },
  },
  authApi: {
    getSession: vi.fn(),
    hasPermission: vi.fn().mockResolvedValue({ success: true }),
    getFullOrganization: vi.fn(),
  },
}));

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: mockPrisma,
  prismaRaw: mockPrisma,
  tenantStore: { run: (_ctx: unknown, fn: () => unknown) => fn(), getStore: vi.fn() },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
  getRegionalClient: vi.fn(() => mockPrisma),
  preWarmRegionalClients: vi.fn(),
}));

// Shared payment-export helpers — file generation + bank resolution are pure
// infra here; the race is on the DB transition, not the file bytes.
vi.mock('../../routers/finance/payment-shared', async importOriginal => {
  const actual = await importOriginal<typeof import('../../routers/finance/payment-shared')>();
  return {
    ...actual,
    // One cross-currency settlement so the winner persists exactly one provenance
    // row; the loser must persist none (asserted below via `itemUpdate`).
    _buildExportItems: vi.fn(async () => ({
      items: [],
      settlements: [
        {
          itemId: 'item-1',
          fromCurrency: 'PLN',
          settlementCurrency: 'USD',
          rate: 0.25,
          rateDate: new Date('2026-04-11'),
        },
      ],
    })),
    _generateExportFileForFormat: vi.fn(async () => ({
      fileBuffer: Buffer.from('file'),
      ext: 'csv',
    })),
    _resolveOrgBankInfo: vi.fn(async () => ({
      orgBank: { iban: 'PL00', bic: 'X', name: 'Org', address: null },
      transferTitleTemplate: null,
    })),
  };
});

vi.mock('../../services/compliance-payment-gate', () => ({
  assertContractorPaymentEligibility: vi.fn(async () => undefined),
}));

vi.mock('../../services/payment-export-compliance-snapshot', () => ({
  buildSnapshotForContractor: vi.fn(async () => ({
    snapshotJson: {
      items: [],
      policyRuleSetVersion: 'v1',
      jurisdictionDate: '2025-03-01',
      eligibilityVerdict: 'PASS',
      failureReasons: [],
    },
    policyRuleSetVersion: 'v1',
    eligibilityVerdict: 'PASS',
    failureReasons: [],
  })),
}));

vi.mock('../../services/audit-writer', () => ({
  writeAuditLog: vi.fn(async () => undefined),
  writeAuditLogMany: vi.fn(async () => undefined),
}));

vi.mock('../../services/org-cache', () => ({
  getOrgMeta: vi.fn(async () => ({ dataRegion: 'EU', status: 'ACTIVE' })),
  invalidateOrgBranding: vi.fn(),
  invalidateOrgMeta: vi.fn(),
}));

import { createCallerFactory } from '../../init';
import { appRouter } from '../../root';

const createCaller = createCallerFactory(appRouter);

function makeCaller() {
  const session = {
    session: {
      id: `session-${USER_ID}`,
      userId: USER_ID,
      activeOrganizationId: ORG_ID,
      expiresAt: new Date('2099-01-01'),
      token: 'mock-token',
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: USER_ID,
      name: 'User',
      email: 'user@example.com',
      emailVerified: true,
      image: null,
      banned: false,
      banReason: null,
      banExpires: null,
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
  return createCaller({
    headers: new Headers(),
    session: session as never,
    user: session.user as never,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (mockPrisma.__resetRunStatus as () => void)();
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockPrisma),
  );
});

describe('payment.lockAndExport double-export TOCTOU (F4)', () => {
  it('only the winning concurrent call creates export + compliance rows', async () => {
    const caller = makeCaller();

    const [first, second] = await Promise.all([
      caller.payment.lockAndExport({ runId: RUN_ID, exportFormat: 'CSV' }),
      caller.payment.lockAndExport({ runId: RUN_ID, exportFormat: 'CSV' }),
    ]);

    // Both callers reached the guarded transition, but exactly one won
    // (`count: 1`) → exactly one export row + one compliance row (single
    // distinct contractor). The loser's `count: 0` skips all row creation.
    // This is the double-export invariant: row writes are gated on the
    // atomic transition, NOT on whether a file was generated.
    expect(mockPrisma.paymentRun.updateMany).toHaveBeenCalledTimes(2);
    expect(exportCreate).toHaveBeenCalledTimes(1);
    expect(complianceCreate).toHaveBeenCalledTimes(1);

    // Neither call threw — both resolve to a run; the second does not
    // double-export.
    expect(first.run).toBeDefined();
    expect(second.run).toBeDefined();

    // The bank file is generated before the guarded transition, so both racers
    // hold a buffer — but only the transition winner may return it. Exactly one
    // of the two responses carries a non-null `fileBase64`; the loser's file is
    // null, so an operator can never receive two copies of the same payment file.
    const filesReturned = [first, second].filter(r => r.fileBase64 != null);
    expect(filesReturned).toHaveLength(1);
  });

  it('only the transition winner persists settlement provenance (loser skips the write)', async () => {
    const caller = makeCaller();

    await Promise.all([
      caller.payment.lockAndExport({ runId: RUN_ID, exportFormat: 'CSV' }),
      caller.payment.lockAndExport({ runId: RUN_ID, exportFormat: 'CSV' }),
    ]);

    // Both racers built the file (and computed its cross-currency settlement
    // rates), but only the winner reaches the provenance persist — the loser
    // returns the null file first. So the idempotent settlement-rate write on
    // `PaymentRunItem` happens exactly once, never twice.
    expect(itemUpdate).toHaveBeenCalledTimes(1);
  });

  it('a second sequential call after export is idempotent and writes no new rows', async () => {
    const caller = makeCaller();

    await caller.payment.lockAndExport({ runId: RUN_ID, exportFormat: 'CSV' });
    expect(exportCreate).toHaveBeenCalledTimes(1);
    expect(complianceCreate).toHaveBeenCalledTimes(1);

    // Run is now EXPORTED — the early idempotent guard short-circuits before
    // ever reaching updateMany on the second call.
    const second = await caller.payment.lockAndExport({ runId: RUN_ID, exportFormat: 'CSV' });

    expect(second.fileBase64 == null).toBe(true);
    expect(exportCreate).toHaveBeenCalledTimes(1);
    expect(complianceCreate).toHaveBeenCalledTimes(1);
  });

  it('the transition where-clause guards on pre-export statuses only', async () => {
    const caller = makeCaller();
    await caller.payment.lockAndExport({ runId: RUN_ID, exportFormat: 'CSV' });

    const where = (mockPrisma.paymentRun.updateMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
      ?.where as { organizationId?: string; status?: { in?: string[] } };
    expect(where.organizationId).toBe(ORG_ID);
    expect(where.status?.in).toEqual(['DRAFT', 'LOCKED']);
  });
});
