import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/db', () => {
  const MockDbPrisma = {
    consentRecord: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return {
    withRlsTransactions: <T>(c: T) => c,
    withRlsReads: <T>(c: T) => c,
    prisma: MockDbPrisma,
    prismaRaw: MockDbPrisma,
  };
});

import { prisma } from '@contractor-ops/db';
import {
  bulkGrantConsent,
  getConsentHistory,
  getCurrentConsent,
  grantConsent,
  hasRequiredConsents,
  revokeConsent,
} from '../consent-record';

const mockPrisma = prisma as unknown as {
  consentRecord: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

const ORG_ID = 'org_test_123';
const USER_ID = 'user_test_456';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('consent-record', () => {
  describe('grantConsent', () => {
    it('creates a record with granted=true and grantedAt set', async () => {
      mockPrisma.consentRecord.count.mockResolvedValue(0);
      mockPrisma.consentRecord.create.mockResolvedValue({
        id: 'cr_1',
        version: 1,
        granted: true,
      });

      const result = await grantConsent(
        ORG_ID,
        USER_ID,
        'CONTRACTOR_DATA_PROCESSING',
        '127.0.0.1',
        'test-agent',
      );

      expect(result).toEqual({ id: 'cr_1', version: 1 });
      expect(mockPrisma.consentRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          userId: USER_ID,
          purpose: 'CONTRACTOR_DATA_PROCESSING',
          granted: true,
          version: 1,
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
        }),
      });
      // Verify grantedAt is set (not null)
      const callArgs = mockPrisma.consentRecord.create.mock.calls[0][0];
      expect(callArgs.data.grantedAt).toBeInstanceOf(Date);
    });
  });

  describe('revokeConsent', () => {
    it('creates a NEW record with granted=false (does not update existing)', async () => {
      mockPrisma.consentRecord.count.mockResolvedValue(1); // already has 1 record
      mockPrisma.consentRecord.create.mockResolvedValue({
        id: 'cr_2',
        version: 2,
        granted: false,
      });

      const result = await revokeConsent(ORG_ID, USER_ID, 'CONTRACTOR_DATA_PROCESSING');

      expect(result).toEqual({ id: 'cr_2', version: 2 });
      expect(mockPrisma.consentRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          granted: false,
          version: 2,
        }),
      });
      // Verify revokedAt is set
      const callArgs = mockPrisma.consentRecord.create.mock.calls[0][0];
      expect(callArgs.data.revokedAt).toBeInstanceOf(Date);
    });
  });

  describe('getCurrentConsent', () => {
    it('returns latest state per purpose', async () => {
      mockPrisma.consentRecord.findMany.mockResolvedValue([
        // Most recent first (orderBy createdAt desc)
        {
          purpose: 'CONTRACTOR_DATA_PROCESSING',
          granted: false,
          version: 2,
          createdAt: new Date('2026-04-11T10:00:00Z'),
        },
        {
          purpose: 'ANALYTICS_REPORTING',
          granted: true,
          version: 1,
          createdAt: new Date('2026-04-11T09:00:00Z'),
        },
        {
          purpose: 'CONTRACTOR_DATA_PROCESSING',
          granted: true,
          version: 1,
          createdAt: new Date('2026-04-10T08:00:00Z'),
        },
      ]);

      const result = await getCurrentConsent(ORG_ID, USER_ID);

      expect(result.size).toBe(2);
      // Should use the most recent record for CONTRACTOR_DATA_PROCESSING
      expect(result.get('CONTRACTOR_DATA_PROCESSING')).toEqual(
        expect.objectContaining({
          granted: false,
          version: 2,
        }),
      );
      expect(result.get('ANALYTICS_REPORTING')).toEqual(
        expect.objectContaining({
          granted: true,
          version: 1,
        }),
      );
    });

    it('returns empty map for new user', async () => {
      mockPrisma.consentRecord.findMany.mockResolvedValue([]);

      const result = await getCurrentConsent(ORG_ID, USER_ID);

      expect(result.size).toBe(0);
    });
  });

  describe('hasRequiredConsents', () => {
    it('returns false when required purpose is missing', async () => {
      mockPrisma.consentRecord.findMany.mockResolvedValue([
        {
          purpose: 'CONTRACTOR_DATA_PROCESSING',
          granted: true,
          version: 1,
          createdAt: new Date(),
        },
        // Missing INVOICE_PAYMENT_PROCESSING and COMMUNICATION_NOTIFICATIONS
      ]);

      const result = await hasRequiredConsents(ORG_ID, USER_ID);
      expect(result).toBe(false);
    });

    it('returns true when all required purposes are granted', async () => {
      mockPrisma.consentRecord.findMany.mockResolvedValue([
        {
          purpose: 'CONTRACTOR_DATA_PROCESSING',
          granted: true,
          version: 1,
          createdAt: new Date(),
        },
        {
          purpose: 'INVOICE_PAYMENT_PROCESSING',
          granted: true,
          version: 1,
          createdAt: new Date(),
        },
        {
          purpose: 'COMMUNICATION_NOTIFICATIONS',
          granted: true,
          version: 1,
          createdAt: new Date(),
        },
      ]);

      const result = await hasRequiredConsents(ORG_ID, USER_ID);
      expect(result).toBe(true);
    });

    it('returns false when required purpose was revoked', async () => {
      mockPrisma.consentRecord.findMany.mockResolvedValue([
        // Most recent first — revoked
        {
          purpose: 'CONTRACTOR_DATA_PROCESSING',
          granted: false,
          version: 2,
          createdAt: new Date('2026-04-11T10:00:00Z'),
        },
        {
          purpose: 'INVOICE_PAYMENT_PROCESSING',
          granted: true,
          version: 1,
          createdAt: new Date('2026-04-11T09:00:00Z'),
        },
        {
          purpose: 'COMMUNICATION_NOTIFICATIONS',
          granted: true,
          version: 1,
          createdAt: new Date('2026-04-11T08:00:00Z'),
        },
        // Older record — was granted before
        {
          purpose: 'CONTRACTOR_DATA_PROCESSING',
          granted: true,
          version: 1,
          createdAt: new Date('2026-04-10T08:00:00Z'),
        },
      ]);

      const result = await hasRequiredConsents(ORG_ID, USER_ID);
      expect(result).toBe(false);
    });
  });

  describe('getConsentHistory', () => {
    it('returns all records ordered by createdAt DESC', async () => {
      const records = [
        {
          id: 'cr_2',
          purpose: 'CONTRACTOR_DATA_PROCESSING',
          granted: false,
          version: 2,
          grantedAt: null,
          revokedAt: new Date('2026-04-11T10:00:00Z'),
          createdAt: new Date('2026-04-11T10:00:00Z'),
        },
        {
          id: 'cr_1',
          purpose: 'CONTRACTOR_DATA_PROCESSING',
          granted: true,
          version: 1,
          grantedAt: new Date('2026-04-10T08:00:00Z'),
          revokedAt: null,
          createdAt: new Date('2026-04-10T08:00:00Z'),
        },
      ];
      mockPrisma.consentRecord.findMany.mockResolvedValue(records);

      const result = await getConsentHistory(ORG_ID, USER_ID, 'CONTRACTOR_DATA_PROCESSING');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('cr_2');
      expect(result[0].granted).toBe(false);
      expect(result[1].granted).toBe(true);
    });
  });

  describe('bulkGrantConsent', () => {
    it('creates records for all provided purposes atomically', async () => {
      const mockTx = {
        consentRecord: {
          count: vi.fn().mockResolvedValue(0),
          create: vi
            .fn()
            .mockResolvedValueOnce({
              id: 'cr_1',
              purpose: 'CONTRACTOR_DATA_PROCESSING',
              granted: true,
              version: 1,
            })
            .mockResolvedValueOnce({
              id: 'cr_2',
              purpose: 'INVOICE_PAYMENT_PROCESSING',
              granted: true,
              version: 1,
            }),
        },
      };

      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
      );

      const result = await bulkGrantConsent(ORG_ID, USER_ID, [
        { purpose: 'CONTRACTOR_DATA_PROCESSING', granted: true },
        { purpose: 'INVOICE_PAYMENT_PROCESSING', granted: true },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].purpose).toBe('CONTRACTOR_DATA_PROCESSING');
      expect(result[1].purpose).toBe('INVOICE_PAYMENT_PROCESSING');
      expect(mockTx.consentRecord.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('version auto-increment', () => {
    it('increments version on subsequent grants', async () => {
      mockPrisma.consentRecord.count.mockResolvedValue(2); // 2 existing records
      mockPrisma.consentRecord.create.mockResolvedValue({
        id: 'cr_3',
        version: 3,
        granted: true,
      });

      const result = await grantConsent(ORG_ID, USER_ID, 'ANALYTICS_REPORTING');

      expect(result.version).toBe(3);
      expect(mockPrisma.consentRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ version: 3 }),
      });
    });
  });
});
