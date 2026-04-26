// Phase 59 Plan 59-03 Task 1 — ir35Chain router contract tests.
import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'org-ir35-001';
const USER_ID = 'user-ir35-001';
const ASSIGNMENT_ID = 'assignment-ir35-001';

// ---------------------------------------------------------------------------
// Mock Prisma (hoisted)
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ dataRegion: 'EU' }),
    },
    ir35ChainParticipant: {
      findMany: vi.fn(async () => []),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    contractorAssignment: {
      findUniqueOrThrow: vi.fn(),
    },
    contractor: {
      findUniqueOrThrow: vi.fn(),
    },
    member: {
      findFirst: vi.fn(async () => ({ role: 'admin' })),
    },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return { mockPrisma };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      hasPermission: vi.fn().mockResolvedValue({ success: true }),
    },
  },
  authApi: {
    hasPermission: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: mockPrisma,
  tenantStore: {
    run: (_ctx: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(() => ({ region: 'EU' })),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
  getRegionalClient: vi.fn(() => mockPrisma),
}));

vi.mock('../../services/r2.js', () => ({
  createPresignedUploadUrl: vi.fn(async () => ({ url: 'https://r2.test/upload', key: 'k' })),
  createPresignedDownloadUrl: vi.fn(async () => 'https://r2.test/download'),
  generateStorageKey: vi.fn(() => 'mock-key'),
}));

vi.mock('../../services/notification-service.js', () => ({
  dispatch: vi.fn(async () => undefined),
}));

vi.mock('../../services/invoice-matching.js', () => ({
  computeDuplicateCheckHash: vi.fn(() => 'hash'),
  runAutoMatch: vi.fn(async () => undefined),
}));

vi.mock('../../services/bank-account-crypto.js', () => ({
  encryptBankAccount: vi.fn((v: string) => `encrypted:${v}`),
}));

vi.mock('../../services/sanitize.js', () => ({
  sanitizeStrings: vi.fn(<T>(v: T) => v),
}));

vi.mock('../../services/approval-engine.js', () => ({
  routeToChain: vi.fn(async () => null),
  createApprovalFlow: vi.fn(async () => ({})),
  advanceFlow: vi.fn(async () => undefined),
  computeSlaStatus: vi.fn(() => 'ON_TIME'),
}));

vi.mock('../../services/calendar-event-service.js', () => ({
  deleteCalendarEvent: vi.fn(async () => undefined),
}));

vi.mock('../../services/calendar-deadline-sync.js', () => ({
  syncPaymentDueDeadline: vi.fn(async () => undefined),
  syncApprovalSlaDeadline: vi.fn(async () => undefined),
}));

vi.mock('../../services/cache.js', () => ({
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: { approvalChains: (orgId: string) => `approval-chains:${orgId}` },
  CacheTTL: { APPROVAL_CHAINS: 300 },
}));

vi.mock('../../services/mime-validator.js', () => ({
  isAllowedMimeType: vi.fn(() => true),
  validateMimeType: vi.fn(async () => ({ valid: true })),
}));

vi.mock('../../services/virus-scanner.js', () => ({
  isClamAvailable: vi.fn(async () => false),
  scanBuffer: vi.fn(async () => ({ clean: true })),
}));

vi.mock('../../services/stripe-client.js', () => ({
  stripe: {
    subscriptions: { retrieve: vi.fn(), update: vi.fn(), list: vi.fn(async () => ({ data: [] })) },
    customers: { create: vi.fn(), retrieve: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    invoices: { retrieveUpcoming: vi.fn() },
  },
}));

vi.mock('../../services/billing-service.js', () => ({
  syncSeatCountForOrg: vi.fn(async () => undefined),
}));

vi.mock('../../services/credit-service.js', () => ({
  deductCredits: vi.fn(async () => undefined),
  getBalance: vi.fn(async () => ({ credits: 0 })),
  hasCredits: vi.fn(async () => true),
}));

vi.mock('../../services/ocr-extraction.js', () => ({
  extractInvoiceData: vi.fn(async () => ({})),
}));

vi.mock('../../services/billing-webhook.js', () => ({
  handleStripeWebhook: vi.fn(async () => undefined),
}));

vi.mock('../../services/report-export.js', () => ({
  generateAuditCsv: vi.fn(async () => ({ base64: 'bW9jaw==', filename: 'audit.csv' })),
}));

vi.mock('../../services/payment-export.js', () => ({
  generateCsv: vi.fn(async () => Buffer.from('csv-data')),
  generateElixir: vi.fn(() => Buffer.from('elixir-data')),
  generateSepaXml: vi.fn(() => Buffer.from('sepa-data')),
  resolveTransferTitle: vi.fn(() => 'FV/2025/001'),
}));

vi.mock('../../services/bank-statement.js', () => ({
  parseBankStatement: vi.fn(() => []),
  matchStatementToRun: vi.fn(() => []),
}));

vi.mock('@sentry/nextjs', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('@contractor-ops/logger', () => ({
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from '../../init.js';
import { appRouter } from '../../root.js';
import { ir35ChainRouter } from '../ir35-chain.js';

// ---------------------------------------------------------------------------
// Caller setup
// ---------------------------------------------------------------------------

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
      name: 'IR35 Admin',
      email: 'admin@test.com',
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

const caller = makeCaller();

// ---------------------------------------------------------------------------
// Reset mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// Contract tests (original)
// ===========================================================================

describe('ir35Chain router (Phase 59 · CLASS-04)', () => {
  it('exposes the 6 required procedures', () => {
    const record = ir35ChainRouter._def.record;
    expect(record).toHaveProperty('listByEngagement');
    expect(record).toHaveProperty('upsertParticipant');
    expect(record).toHaveProperty('reorderParticipants');
    expect(record).toHaveProperty('markDelivered');
    expect(record).toHaveProperty('markAcknowledged');
    expect(record).toHaveProperty('removeParticipant');
  });

  it('listByEngagement is a query', () => {
    const proc = ir35ChainRouter._def.record.listByEngagement;
    expect(
      (proc as unknown as { _def?: { type?: string } })._def?.type ??
        (proc as { type?: string }).type,
    ).toBe('query');
  });

  it('mutations are typed as mutations', () => {
    const record = ir35ChainRouter._def.record;
    for (const key of [
      'upsertParticipant',
      'reorderParticipants',
      'markDelivered',
      'markAcknowledged',
      'removeParticipant',
    ] as const) {
      const proc = record[key];
      const type =
        (proc as unknown as { _def?: { type?: string } })._def?.type ??
        (proc as { type?: string }).type;
      expect(type, `${key} should be a mutation`).toBe('mutation');
    }
  });
});

// ===========================================================================
// listByEngagement
// ===========================================================================

describe('ir35Chain.listByEngagement', () => {
  it('returns existing participants when rows already exist', async () => {
    const participants = [
      { id: 'p-1', role: 'CLIENT', orderIndex: 0, displayName: 'Org' },
      { id: 'p-2', role: 'WORKER', orderIndex: 1, displayName: 'Contractor' },
    ];
    mockPrisma.ir35ChainParticipant.findMany.mockResolvedValueOnce(participants);

    const result = await caller.ir35Chain.listByEngagement({
      contractorAssignmentId: ASSIGNMENT_ID,
    });

    expect(result).toEqual(participants);
    // Should NOT query for engagement (no auto-seed needed)
    expect(mockPrisma.contractorAssignment.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('auto-seeds CLIENT + WORKER for GB engagement when no participants exist', async () => {
    // First findMany returns empty (triggers auto-seed)
    mockPrisma.ir35ChainParticipant.findMany.mockResolvedValueOnce([]);
    mockPrisma.contractorAssignment.findUniqueOrThrow.mockResolvedValueOnce({
      id: ASSIGNMENT_ID,
      contractor: { id: 'c-1', displayName: 'Jane Doe', countryCode: 'GB' },
      organization: { id: ORG_ID, name: 'Acme Corp' },
    });
    mockPrisma.ir35ChainParticipant.createMany.mockResolvedValueOnce({ count: 2 });
    // Second findMany returns seeded rows
    const seeded = [
      { id: 'p-1', role: 'CLIENT', orderIndex: 0, displayName: 'Acme Corp' },
      { id: 'p-2', role: 'WORKER', orderIndex: 1, displayName: 'Jane Doe' },
    ];
    mockPrisma.ir35ChainParticipant.findMany.mockResolvedValueOnce(seeded);

    const result = await caller.ir35Chain.listByEngagement({
      contractorAssignmentId: ASSIGNMENT_ID,
    });

    expect(result).toEqual(seeded);
    expect(mockPrisma.ir35ChainParticipant.createMany).toHaveBeenCalledTimes(1);
  });

  it('returns empty array for non-GB engagement with no participants', async () => {
    mockPrisma.ir35ChainParticipant.findMany.mockResolvedValueOnce([]);
    mockPrisma.contractorAssignment.findUniqueOrThrow.mockResolvedValueOnce({
      id: ASSIGNMENT_ID,
      contractor: { id: 'c-1', displayName: 'Jane Doe', countryCode: 'US' },
      organization: { id: ORG_ID, name: 'Acme Corp' },
    });

    const result = await caller.ir35Chain.listByEngagement({
      contractorAssignmentId: ASSIGNMENT_ID,
    });

    expect(result).toEqual([]);
    expect(mockPrisma.ir35ChainParticipant.createMany).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND when engagement does not exist', async () => {
    mockPrisma.ir35ChainParticipant.findMany.mockResolvedValueOnce([]);
    mockPrisma.contractorAssignment.findUniqueOrThrow.mockRejectedValueOnce(new Error('Not found'));

    await expect(
      caller.ir35Chain.listByEngagement({ contractorAssignmentId: 'nonexistent' }),
    ).rejects.toThrow(TRPCError);
  });
});

// ===========================================================================
// upsertParticipant
// ===========================================================================

describe('ir35Chain.upsertParticipant', () => {
  it('creates a new participant when no id provided', async () => {
    const created = {
      id: 'p-new',
      organizationId: ORG_ID,
      contractorAssignmentId: ASSIGNMENT_ID,
      role: 'AGENCY',
      orderIndex: 1,
      displayName: 'Agency Ltd',
    };
    mockPrisma.ir35ChainParticipant.create.mockResolvedValueOnce(created);

    const result = await caller.ir35Chain.upsertParticipant({
      contractorAssignmentId: ASSIGNMENT_ID,
      role: 'AGENCY',
      orderIndex: 1,
      displayName: 'Agency Ltd',
    });

    expect(result).toMatchObject({ id: 'p-new', role: 'AGENCY' });
    expect(mockPrisma.ir35ChainParticipant.create).toHaveBeenCalledTimes(1);
  });

  it('updates an existing participant when id is provided', async () => {
    const updated = {
      id: 'p-existing',
      role: 'AGENCY',
      orderIndex: 2,
      displayName: 'Updated Agency',
    };
    mockPrisma.ir35ChainParticipant.update.mockResolvedValueOnce(updated);

    const result = await caller.ir35Chain.upsertParticipant({
      id: 'p-existing',
      contractorAssignmentId: ASSIGNMENT_ID,
      role: 'AGENCY',
      orderIndex: 2,
      displayName: 'Updated Agency',
    });

    expect(result).toMatchObject({ id: 'p-existing', displayName: 'Updated Agency' });
    expect(mockPrisma.ir35ChainParticipant.update).toHaveBeenCalledTimes(1);
  });

  it('throws BAD_REQUEST when CLIENT role has linkedContractorId', async () => {
    mockPrisma.contractor.findUniqueOrThrow.mockResolvedValueOnce({ id: 'c-1' });

    await expect(
      caller.ir35Chain.upsertParticipant({
        contractorAssignmentId: ASSIGNMENT_ID,
        role: 'CLIENT',
        orderIndex: 0,
        displayName: 'Client',
        linkedContractorId: 'c-1',
      }),
    ).rejects.toThrow('CLIENT participants cannot have a linkedContractorId');
  });

  it('throws NOT_FOUND when linkedContractorId does not exist', async () => {
    mockPrisma.contractor.findUniqueOrThrow.mockRejectedValueOnce(new Error('Not found'));

    await expect(
      caller.ir35Chain.upsertParticipant({
        contractorAssignmentId: ASSIGNMENT_ID,
        role: 'AGENCY',
        orderIndex: 1,
        displayName: 'Agency',
        linkedContractorId: 'nonexistent',
      }),
    ).rejects.toThrow(TRPCError);
  });
});

// ===========================================================================
// reorderParticipants
// ===========================================================================

describe('ir35Chain.reorderParticipants', () => {
  it('reorders participants by orderedIds array', async () => {
    mockPrisma.ir35ChainParticipant.findMany
      .mockResolvedValueOnce([{ id: 'p-1' }, { id: 'p-2' }])
      .mockResolvedValueOnce([
        { id: 'p-2', orderIndex: 0 },
        { id: 'p-1', orderIndex: 1 },
      ]);
    mockPrisma.ir35ChainParticipant.update.mockResolvedValue({});

    const result = await caller.ir35Chain.reorderParticipants({
      contractorAssignmentId: ASSIGNMENT_ID,
      orderedIds: ['p-2', 'p-1'],
    });

    expect(mockPrisma.ir35ChainParticipant.update).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
  });

  it('throws BAD_REQUEST on duplicate ids', async () => {
    mockPrisma.ir35ChainParticipant.findMany.mockResolvedValueOnce([{ id: 'p-1' }, { id: 'p-2' }]);

    await expect(
      caller.ir35Chain.reorderParticipants({
        contractorAssignmentId: ASSIGNMENT_ID,
        orderedIds: ['p-1', 'p-1'],
      }),
    ).rejects.toThrow('Duplicate ids in orderedIds');
  });

  it('throws BAD_REQUEST when orderedIds count does not match participants', async () => {
    mockPrisma.ir35ChainParticipant.findMany.mockResolvedValueOnce([
      { id: 'p-1' },
      { id: 'p-2' },
      { id: 'p-3' },
    ]);

    await expect(
      caller.ir35Chain.reorderParticipants({
        contractorAssignmentId: ASSIGNMENT_ID,
        orderedIds: ['p-1', 'p-2'],
      }),
    ).rejects.toThrow('orderedIds must list every participant exactly once');
  });

  it('throws BAD_REQUEST when orderedIds contains foreign id', async () => {
    mockPrisma.ir35ChainParticipant.findMany.mockResolvedValueOnce([{ id: 'p-1' }, { id: 'p-2' }]);

    await expect(
      caller.ir35Chain.reorderParticipants({
        contractorAssignmentId: ASSIGNMENT_ID,
        orderedIds: ['p-1', 'p-foreign'],
      }),
    ).rejects.toThrow('does not belong to engagement');
  });
});

// ===========================================================================
// markDelivered
// ===========================================================================

describe('ir35Chain.markDelivered', () => {
  it('sets sdsDeliveredAt and preserves note', async () => {
    mockPrisma.ir35ChainParticipant.update.mockResolvedValueOnce({
      id: 'p-1',
      sdsDeliveredAt: new Date(),
      sdsDeliveredNote: 'Sent via email',
    });

    const result = await caller.ir35Chain.markDelivered({
      id: 'p-1',
      note: 'Sent via email',
    });

    expect(result.sdsDeliveredAt).toBeDefined();
    expect(result.sdsDeliveredNote).toBe('Sent via email');
    const call = mockPrisma.ir35ChainParticipant.update.mock.calls[0][0];
    expect(call.data.sdsDeliveredNote).toBe('Sent via email');
  });

  it('sets sdsDeliveredNote to null when no note provided', async () => {
    mockPrisma.ir35ChainParticipant.update.mockResolvedValueOnce({
      id: 'p-1',
      sdsDeliveredAt: new Date(),
      sdsDeliveredNote: null,
    });

    await caller.ir35Chain.markDelivered({ id: 'p-1' });

    const call = mockPrisma.ir35ChainParticipant.update.mock.calls[0][0];
    expect(call.data.sdsDeliveredNote).toBeNull();
  });
});

// ===========================================================================
// markAcknowledged
// ===========================================================================

describe('ir35Chain.markAcknowledged', () => {
  it('sets sdsAcknowledgedAt and preserves note', async () => {
    mockPrisma.ir35ChainParticipant.update.mockResolvedValueOnce({
      id: 'p-1',
      sdsAcknowledgedAt: new Date(),
      sdsAcknowledgedNote: 'Confirmed receipt',
    });

    const result = await caller.ir35Chain.markAcknowledged({
      id: 'p-1',
      note: 'Confirmed receipt',
    });

    expect(result.sdsAcknowledgedAt).toBeDefined();
    expect(result.sdsAcknowledgedNote).toBe('Confirmed receipt');
  });

  it('sets sdsAcknowledgedNote to null when no note provided', async () => {
    mockPrisma.ir35ChainParticipant.update.mockResolvedValueOnce({
      id: 'p-1',
      sdsAcknowledgedAt: new Date(),
      sdsAcknowledgedNote: null,
    });

    await caller.ir35Chain.markAcknowledged({ id: 'p-1' });

    const call = mockPrisma.ir35ChainParticipant.update.mock.calls[0][0];
    expect(call.data.sdsAcknowledgedNote).toBeNull();
  });
});

// ===========================================================================
// removeParticipant
// ===========================================================================

describe('ir35Chain.removeParticipant', () => {
  it('deletes an AGENCY participant', async () => {
    mockPrisma.ir35ChainParticipant.findUniqueOrThrow.mockResolvedValueOnce({
      role: 'AGENCY',
    });
    mockPrisma.ir35ChainParticipant.delete.mockResolvedValueOnce({});

    const result = await caller.ir35Chain.removeParticipant({ id: 'p-agency' });

    expect(result).toEqual({ deletedId: 'p-agency' });
    expect(mockPrisma.ir35ChainParticipant.delete).toHaveBeenCalledWith({
      where: { id: 'p-agency' },
    });
  });

  it('blocks removal of CLIENT role', async () => {
    mockPrisma.ir35ChainParticipant.findUniqueOrThrow.mockResolvedValueOnce({
      role: 'CLIENT',
    });

    await expect(caller.ir35Chain.removeParticipant({ id: 'p-client' })).rejects.toThrow(
      'CLIENT and WORKER rows are auto-populated and cannot be removed',
    );
  });

  it('blocks removal of WORKER role', async () => {
    mockPrisma.ir35ChainParticipant.findUniqueOrThrow.mockResolvedValueOnce({
      role: 'WORKER',
    });

    await expect(caller.ir35Chain.removeParticipant({ id: 'p-worker' })).rejects.toThrow(
      'CLIENT and WORKER rows are auto-populated and cannot be removed',
    );
  });

  it('throws NOT_FOUND when participant does not exist', async () => {
    mockPrisma.ir35ChainParticipant.findUniqueOrThrow.mockRejectedValueOnce(new Error('Not found'));

    await expect(caller.ir35Chain.removeParticipant({ id: 'nonexistent' })).rejects.toThrow(
      TRPCError,
    );
  });
});
