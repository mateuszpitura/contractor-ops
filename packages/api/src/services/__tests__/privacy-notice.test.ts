import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    privacyNotice: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    organization: {
      findUniqueOrThrow: vi.fn(),
    },
  },
}));

vi.mock('../cache.js', () => ({
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  CacheKeys: {},
  CacheTTL: { ORG_SETTINGS: 900 },
  cacheKey: (...segments: string[]) => segments.join(':'),
}));

import { prisma } from '@contractor-ops/db';
import {
  createPrivacyNotice,
  getDefaultNoticeContent,
  getPrivacyNotice,
} from '../privacy-notice.js';

const mockPrisma = prisma as unknown as {
  privacyNotice: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  organization: {
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
  };
};

const ORG_ID = 'org_test_123';

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.organization.findUniqueOrThrow.mockResolvedValue({
    name: 'Test Corp',
    countryCode: 'AE',
  });
});

describe('privacy-notice', () => {
  describe('getDefaultNoticeContent', () => {
    it('returns UAE PDPL reference for AE jurisdiction', () => {
      const content = getDefaultNoticeContent('AE');

      expect(content.jurisdiction).toBe('AE');
      expect(content.legalReference).toContain('Federal Decree-Law No. 45/2021');
      expect(content.sections.length).toBeGreaterThan(0);
      expect(content.sections.some(s => s.title === 'Your Rights')).toBe(true);
    });

    it('returns Saudi PDPL reference for SA jurisdiction', () => {
      const content = getDefaultNoticeContent('SA');

      expect(content.jurisdiction).toBe('SA');
      expect(content.legalReference).toContain('Royal Decree M/19');
      expect(content.sections.length).toBeGreaterThan(0);
      expect(content.sections.some(s => s.title === 'Data Protection Officer')).toBe(true);
    });
  });

  describe('getPrivacyNotice', () => {
    it('returns null for non-PDPL jurisdiction', async () => {
      const result = await getPrivacyNotice(ORG_ID, 'PL');
      expect(result).toBeNull();
    });

    it('creates default notice for AE org when none exists', async () => {
      mockPrisma.privacyNotice.findFirst.mockResolvedValue(null);
      mockPrisma.privacyNotice.create.mockResolvedValue({
        id: 'pn_1',
        version: 1,
      });

      const result = await getPrivacyNotice(ORG_ID, 'AE');

      expect(result).not.toBeNull();
      expect(result?.jurisdiction).toBe('AE');
      expect(result?.controller.name).toBe('Test Corp');
      expect(result?.legalReference).toContain('Federal Decree-Law No. 45/2021');
      // Should have created default notice
      expect(mockPrisma.privacyNotice.create).toHaveBeenCalled();
    });

    it('returns existing notice for AE org', async () => {
      const existingContent = getDefaultNoticeContent('AE');
      mockPrisma.privacyNotice.findFirst.mockResolvedValue({
        id: 'pn_1',
        version: 1,
        contentJson: existingContent,
      });

      const result = await getPrivacyNotice(ORG_ID, 'AE');

      expect(result).not.toBeNull();
      expect(result?.controller.name).toBe('Test Corp');
      // Should NOT create a new notice
      expect(mockPrisma.privacyNotice.create).not.toHaveBeenCalled();
    });
  });

  describe('createPrivacyNotice', () => {
    it('auto-increments version number', async () => {
      mockPrisma.privacyNotice.findFirst.mockResolvedValue({
        version: 2,
      });
      mockPrisma.privacyNotice.create.mockResolvedValue({
        id: 'pn_3',
        version: 3,
      });

      const result = await createPrivacyNotice(ORG_ID, 'AE', {
        test: 'content',
      });

      expect(result.version).toBe(3);
      expect(mockPrisma.privacyNotice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          version: 3,
          organizationId: ORG_ID,
          jurisdiction: 'AE',
        }),
      });
    });

    it('starts at version 1 when no prior notices exist', async () => {
      mockPrisma.privacyNotice.findFirst.mockResolvedValue(null);
      mockPrisma.privacyNotice.create.mockResolvedValue({
        id: 'pn_1',
        version: 1,
      });

      const result = await createPrivacyNotice(ORG_ID, 'SA', {
        test: 'content',
      });

      expect(result.version).toBe(1);
    });
  });
});
