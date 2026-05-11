import { resetServerEnvCacheForTesting } from '@contractor-ops/validators';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: {
    organization: {
      findUniqueOrThrow: vi.fn(),
    },
    member: {
      findFirst: vi.fn(),
    },
    consentRecord: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from '@contractor-ops/db';
import { detectCrossBorderTransfer, generateDPA, generateSCC } from '../legal-document-generation';

const mockPrisma = prisma as unknown as {
  organization: {
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
  };
  member: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  consentRecord: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

const ORG_ID = 'org_legal_test_001';

beforeEach(() => {
  vi.clearAllMocks();
  resetServerEnvCacheForTesting();
  process.env.DATA_HOSTING_REGION = 'EU';
});

describe('legal-document-generation', () => {
  describe('detectCrossBorderTransfer', () => {
    it('returns isCrossBorder=true for AE org with EU hosting', () => {
      const result = detectCrossBorderTransfer('AE');

      expect(result.isCrossBorder).toBe(true);
      expect(result.orgRegion).toBe('GCC');
      expect(result.hostingRegion).toBe('EU');
    });

    it('returns isCrossBorder=false for PL org with EU hosting', () => {
      const result = detectCrossBorderTransfer('PL');

      expect(result.isCrossBorder).toBe(false);
      expect(result.orgRegion).toBe('EU');
      expect(result.hostingRegion).toBe('EU');
    });

    it('returns isCrossBorder=true for SA org with EU hosting (default)', () => {
      const result = detectCrossBorderTransfer('SA');

      expect(result.isCrossBorder).toBe(true);
      expect(result.orgRegion).toBe('GCC');
      expect(result.hostingRegion).toBe('EU');
    });

    it('returns OTHER region for unknown country', () => {
      const result = detectCrossBorderTransfer('XX');

      expect(result.orgRegion).toBe('OTHER');
    });
  });

  describe('generateDPA', () => {
    it('returns DPA content for AE org', async () => {
      mockPrisma.organization.findUniqueOrThrow.mockResolvedValue({
        name: 'Test Corp',
        countryCode: 'AE',
      });
      mockPrisma.member.findFirst.mockResolvedValue({
        userId: 'user_1',
      });
      mockPrisma.consentRecord.findMany.mockResolvedValue([
        { purpose: 'CONTRACTOR_DATA_PROCESSING', granted: true, version: 1, createdAt: new Date() },
      ]);

      const result = await generateDPA(ORG_ID);

      expect(result).not.toBeNull();
      expect(result?.content).toContain('Federal Decree-Law No. 45/2021');
      expect(result?.content).toContain('Test Corp');
      expect(result?.filename).toContain('AE');
      expect(result?.jurisdiction).toBe('AE');
    });

    it('returns DPA content for SA org', async () => {
      mockPrisma.organization.findUniqueOrThrow.mockResolvedValue({
        name: 'Saudi Co',
        countryCode: 'SA',
      });
      mockPrisma.member.findFirst.mockResolvedValue({
        userId: 'user_1',
      });
      mockPrisma.consentRecord.findMany.mockResolvedValue([]);

      const result = await generateDPA(ORG_ID);

      expect(result).not.toBeNull();
      expect(result?.content).toContain('Royal Decree M/19');
      expect(result?.content).toContain('Saudi Co');
      expect(result?.jurisdiction).toBe('SA');
    });

    it('returns null for non-PDPL jurisdiction', async () => {
      mockPrisma.organization.findUniqueOrThrow.mockResolvedValue({
        name: 'Polish Co',
        countryCode: 'PL',
      });

      const result = await generateDPA(ORG_ID);
      expect(result).toBeNull();
    });
  });

  describe('generateSCC', () => {
    it('returns null when org is in same region as hosting (EU org, EU hosting)', async () => {
      mockPrisma.organization.findUniqueOrThrow.mockResolvedValue({
        name: 'Polish Corp',
        countryCode: 'PL',
      });

      const result = await generateSCC(ORG_ID);
      expect(result).toBeNull();
    });

    it('returns SCC content for cross-border AE org', async () => {
      process.env.DATA_HOSTING_REGION = 'EU';
      mockPrisma.organization.findUniqueOrThrow.mockResolvedValue({
        name: 'UAE Corp',
        countryCode: 'AE',
      });

      const result = await generateSCC(ORG_ID);

      expect(result).not.toBeNull();
      expect(result?.content).toContain('Standard Contractual Clauses');
      expect(result?.content).toContain('GCC');
      expect(result?.content).toContain('EU');
      expect(result?.content).toContain('UAE Corp');
      expect(result?.filename).toContain('GCC-to-EU');
    });

    it('returns null for org without countryCode', async () => {
      mockPrisma.organization.findUniqueOrThrow.mockResolvedValue({
        name: 'No Country',
        countryCode: null,
      });

      const result = await generateSCC(ORG_ID);
      expect(result).toBeNull();
    });
  });
});
