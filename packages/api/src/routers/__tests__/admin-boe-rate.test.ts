/**
 * adminBoeRateRouter unit tests.
 *
 * Tests list, insert, update, and delete procedures including
 * happy paths, uniqueness enforcement, cache invalidation,
 * input validation, ordering, and NOT_FOUND error paths.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'org-boe-001';
const USER_ID = 'user-boe-001';
const ENTRY_ID = 'boe-entry-001';

// ---------------------------------------------------------------------------
// Mock services via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockInvalidateBoeRateCache } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    boEBaseRateHistory: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    organization: {
      findUnique: vi.fn().mockResolvedValue({ dataRegion: 'EU' }),
    },
    member: {
      findFirst: vi.fn().mockResolvedValue({ role: 'admin' }),
    },
    $transaction: vi.fn(async (fnOrArray: ((tx: Rec) => Promise<unknown>) | unknown[]) => {
      if (typeof fnOrArray === 'function') return fnOrArray(mockPrisma);
      return Promise.all(fnOrArray);
    }),
  };

  return {
    mockPrisma,
    mockInvalidateBoeRateCache: vi.fn(),
  };
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

vi.mock('../../services/boe-rate-cache.js', () => ({
  invalidateBoeRateCache: mockInvalidateBoeRateCache,
}));

vi.mock('@sentry/nextjs', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('@contractor-ops/logger', () => ({
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from '../../init.js';
import { adminBoeRateRouter } from '../admin-boe-rate.js';

// ---------------------------------------------------------------------------
// Caller helper
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(adminBoeRateRouter);

function makeCaller(userId = USER_ID, orgId = ORG_ID) {
  const session = {
    session: {
      id: `session-${userId}`,
      userId,
      activeOrganizationId: orgId,
      expiresAt: new Date('2099-01-01'),
      token: 'mock-token',
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: userId,
      name: 'BoE Admin User',
      email: `${userId}@example.com`,
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
// Tests
// ===========================================================================

describe('adminBoeRateRouter', () => {
  // =========================================================================
  // list
  // =========================================================================

  describe('list', () => {
    it('returns all entries ordered by effectiveFrom desc', async () => {
      const entries = [
        {
          id: 'boe-2',
          effectiveFrom: new Date('2024-07-01'),
          ratePercent: 5.25,
          source: 'MANUAL',
          recordedByUserId: USER_ID,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'boe-1',
          effectiveFrom: new Date('2024-01-01'),
          ratePercent: 5.0,
          source: 'CRON',
          recordedByUserId: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      (mockPrisma.boEBaseRateHistory.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        entries,
      );

      const result = await caller.list();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: 'boe-2', ratePercent: 5.25 });
    });

    it('passes orderBy effectiveFrom desc to Prisma', async () => {
      (mockPrisma.boEBaseRateHistory.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        [],
      );

      await caller.list();

      const call = (mockPrisma.boEBaseRateHistory.findMany as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0];
      expect(call.orderBy).toEqual({ effectiveFrom: 'desc' });
    });

    it('returns an empty array when no entries exist', async () => {
      (mockPrisma.boEBaseRateHistory.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        [],
      );

      const result = await caller.list();

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // insert
  // =========================================================================

  describe('insert', () => {
    const effectiveFrom = new Date('2025-01-01T00:00:00.000Z');

    it('creates an entry and returns it', async () => {
      (mockPrisma.boEBaseRateHistory.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        null,
      );
      const created = {
        id: ENTRY_ID,
        effectiveFrom,
        ratePercent: 4.75,
        source: 'MANUAL',
        recordedByUserId: USER_ID,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (mockPrisma.boEBaseRateHistory.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        created,
      );

      const result = await caller.insert({ effectiveFrom, ratePercent: 4.75 });

      expect(result).toMatchObject({ id: ENTRY_ID, ratePercent: 4.75 });
    });

    it('calls create with MANUAL source and the caller user ID', async () => {
      (mockPrisma.boEBaseRateHistory.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        null,
      );
      (mockPrisma.boEBaseRateHistory.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: ENTRY_ID,
        effectiveFrom,
        ratePercent: 4.75,
        source: 'MANUAL',
        recordedByUserId: USER_ID,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await caller.insert({ effectiveFrom, ratePercent: 4.75 });

      const call = (mockPrisma.boEBaseRateHistory.create as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0];
      expect(call.data).toMatchObject({
        effectiveFrom,
        ratePercent: 4.75,
        source: 'MANUAL',
        recordedByUserId: USER_ID,
      });
    });

    it('calls invalidateBoeRateCache after successful insert', async () => {
      (mockPrisma.boEBaseRateHistory.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        null,
      );
      (mockPrisma.boEBaseRateHistory.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: ENTRY_ID,
        effectiveFrom,
        ratePercent: 4.75,
        source: 'MANUAL',
        recordedByUserId: USER_ID,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await caller.insert({ effectiveFrom, ratePercent: 4.75 });

      expect(mockInvalidateBoeRateCache).toHaveBeenCalledTimes(1);
    });

    it('throws CONFLICT when a rate entry already exists for the same effectiveFrom', async () => {
      (mockPrisma.boEBaseRateHistory.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'existing-entry',
        effectiveFrom,
        ratePercent: 5.0,
      });

      await expect(caller.insert({ effectiveFrom, ratePercent: 4.75 })).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('does not call create when uniqueness check fails', async () => {
      (mockPrisma.boEBaseRateHistory.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'existing-entry',
        effectiveFrom,
        ratePercent: 5.0,
      });

      await caller.insert({ effectiveFrom, ratePercent: 4.75 }).catch(() => undefined);

      expect(mockPrisma.boEBaseRateHistory.create).not.toHaveBeenCalled();
    });

    it('rejects ratePercent below 0', async () => {
      await expect(caller.insert({ effectiveFrom, ratePercent: -0.01 })).rejects.toThrow();
    });

    it('rejects ratePercent above 99.99', async () => {
      await expect(caller.insert({ effectiveFrom, ratePercent: 100 })).rejects.toThrow();
    });

    it('accepts ratePercent at boundary value 0', async () => {
      (mockPrisma.boEBaseRateHistory.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        null,
      );
      (mockPrisma.boEBaseRateHistory.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: ENTRY_ID,
        effectiveFrom,
        ratePercent: 0,
        source: 'MANUAL',
        recordedByUserId: USER_ID,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(caller.insert({ effectiveFrom, ratePercent: 0 })).resolves.toBeDefined();
    });

    it('accepts ratePercent at boundary value 99.99', async () => {
      (mockPrisma.boEBaseRateHistory.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        null,
      );
      (mockPrisma.boEBaseRateHistory.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: ENTRY_ID,
        effectiveFrom,
        ratePercent: 99.99,
        source: 'MANUAL',
        recordedByUserId: USER_ID,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(caller.insert({ effectiveFrom, ratePercent: 99.99 })).resolves.toBeDefined();
    });

    it('stores optional notes when provided', async () => {
      (mockPrisma.boEBaseRateHistory.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        null,
      );
      (mockPrisma.boEBaseRateHistory.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: ENTRY_ID,
        effectiveFrom,
        ratePercent: 4.75,
        source: 'MANUAL',
        recordedByUserId: USER_ID,
        notes: 'Emergency cut',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await caller.insert({ effectiveFrom, ratePercent: 4.75, notes: 'Emergency cut' });

      const call = (mockPrisma.boEBaseRateHistory.create as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0];
      expect(call.data.notes).toBe('Emergency cut');
    });
  });

  // =========================================================================
  // update
  // =========================================================================

  describe('update', () => {
    it('updates an existing entry and returns it', async () => {
      const existing = {
        id: ENTRY_ID,
        effectiveFrom: new Date('2025-01-01'),
        ratePercent: 4.75,
        notes: null,
      };
      const updated = { ...existing, ratePercent: 5.0 };

      (mockPrisma.boEBaseRateHistory.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        existing,
      );
      (mockPrisma.boEBaseRateHistory.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        updated,
      );

      const result = await caller.update({ id: ENTRY_ID, ratePercent: 5.0 });

      expect(result).toMatchObject({ id: ENTRY_ID, ratePercent: 5.0 });
    });

    it('calls invalidateBoeRateCache after successful update', async () => {
      (mockPrisma.boEBaseRateHistory.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: ENTRY_ID,
        ratePercent: 4.75,
        notes: null,
      });
      (mockPrisma.boEBaseRateHistory.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: ENTRY_ID,
        ratePercent: 5.0,
        notes: null,
      });

      await caller.update({ id: ENTRY_ID, ratePercent: 5.0 });

      expect(mockInvalidateBoeRateCache).toHaveBeenCalledTimes(1);
    });

    it('throws NOT_FOUND when entry does not exist', async () => {
      (mockPrisma.boEBaseRateHistory.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        null,
      );

      await expect(caller.update({ id: 'nonexistent', ratePercent: 5.0 })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('does not call update when entry is not found', async () => {
      (mockPrisma.boEBaseRateHistory.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        null,
      );

      await caller.update({ id: 'nonexistent', ratePercent: 5.0 }).catch(() => undefined);

      expect(mockPrisma.boEBaseRateHistory.update).not.toHaveBeenCalled();
    });

    it('rejects ratePercent above 99.99 on update', async () => {
      await expect(caller.update({ id: ENTRY_ID, ratePercent: 100 })).rejects.toThrow();
    });
  });

  // =========================================================================
  // delete
  // =========================================================================

  describe('delete', () => {
    it('deletes an existing entry and returns deleted: true', async () => {
      (mockPrisma.boEBaseRateHistory.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: ENTRY_ID,
        effectiveFrom: new Date('2025-01-01'),
        ratePercent: 4.75,
      });
      (mockPrisma.boEBaseRateHistory.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: ENTRY_ID,
      });

      const result = await caller.delete({ id: ENTRY_ID });

      expect(result).toEqual({ deleted: true });
    });

    it('calls invalidateBoeRateCache after successful delete', async () => {
      (mockPrisma.boEBaseRateHistory.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: ENTRY_ID,
        effectiveFrom: new Date('2025-01-01'),
        ratePercent: 4.75,
      });
      (mockPrisma.boEBaseRateHistory.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: ENTRY_ID,
      });

      await caller.delete({ id: ENTRY_ID });

      expect(mockInvalidateBoeRateCache).toHaveBeenCalledTimes(1);
    });

    it('throws NOT_FOUND when entry does not exist', async () => {
      (mockPrisma.boEBaseRateHistory.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        null,
      );

      await expect(caller.delete({ id: 'nonexistent' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('does not call delete when entry is not found', async () => {
      (mockPrisma.boEBaseRateHistory.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        null,
      );

      await caller.delete({ id: 'nonexistent' }).catch(() => undefined);

      expect(mockPrisma.boEBaseRateHistory.delete).not.toHaveBeenCalled();
    });

    it('does not call invalidateBoeRateCache when entry is not found', async () => {
      (mockPrisma.boEBaseRateHistory.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        null,
      );

      await caller.delete({ id: 'nonexistent' }).catch(() => undefined);

      expect(mockInvalidateBoeRateCache).not.toHaveBeenCalled();
    });
  });
});
