import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    contractorChangeRequest: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    contractorBillingProfile: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '@contractor-ops/db';
import {
  approveChangeRequest,
  createChangeRequest,
  rejectChangeRequest,
} from '../portal-change-request.js';

const mockPrisma = prisma as any;

const CONTRACTOR_ID = 'contractor-1';
const ORG_ID = 'org-1';
const REVIEWER_ID = 'reviewer-1';
const REQUEST_ID = 'req-1';

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
});

describe('portal-change-request', () => {
  describe('createChangeRequest', () => {
    it('creates a PENDING change request with requestedChanges and previousValues JSON', async () => {
      mockPrisma.contractorChangeRequest.findFirst.mockResolvedValue(null);
      mockPrisma.contractorChangeRequest.create.mockResolvedValue({
        id: REQUEST_ID,
        status: 'PENDING',
        requestedChanges: { bankName: 'New Bank' },
        previousValues: { bankName: 'Old Bank' },
      });

      const result = await createChangeRequest(
        CONTRACTOR_ID,
        ORG_ID,
        { bankName: 'New Bank' },
        { bankName: 'Old Bank' },
      );

      expect(mockPrisma.contractorChangeRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          contractorId: CONTRACTOR_ID,
          requestedChanges: { bankName: 'New Bank' },
          previousValues: { bankName: 'Old Bank' },
        }),
      });
      expect(result.status).toBe('PENDING');
    });

    it('throws CONFLICT when a PENDING request already exists for the same contractor+org', async () => {
      mockPrisma.contractorChangeRequest.findFirst.mockResolvedValue({
        id: 'existing-req',
        status: 'PENDING',
      });

      await expect(
        createChangeRequest(CONTRACTOR_ID, ORG_ID, { bankName: 'X' }, {}),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('allows new request after previous one is APPROVED', async () => {
      // findFirst for PENDING returns null (no pending requests)
      mockPrisma.contractorChangeRequest.findFirst.mockResolvedValue(null);
      mockPrisma.contractorChangeRequest.create.mockResolvedValue({
        id: 'req-2',
        status: 'PENDING',
      });

      const result = await createChangeRequest(
        CONTRACTOR_ID,
        ORG_ID,
        { taxId: '111' },
        { taxId: '000' },
      );

      expect(result.status).toBe('PENDING');
    });

    it('allows new request after previous one is REJECTED', async () => {
      mockPrisma.contractorChangeRequest.findFirst.mockResolvedValue(null);
      mockPrisma.contractorChangeRequest.create.mockResolvedValue({
        id: 'req-3',
        status: 'PENDING',
      });

      const result = await createChangeRequest(
        CONTRACTOR_ID,
        ORG_ID,
        { swiftBic: 'NEWSWIFT' },
        { swiftBic: 'OLDSWIFT' },
      );

      expect(result.status).toBe('PENDING');
    });
  });

  describe('approveChangeRequest', () => {
    it('applies requestedChanges to default billing profile in a transaction', async () => {
      mockPrisma.contractorChangeRequest.findFirst.mockResolvedValue({
        id: REQUEST_ID,
        status: 'PENDING',
        contractorId: CONTRACTOR_ID,
        requestedChanges: { bankName: 'Updated Bank', swiftBic: 'SWIFT123' },
      });
      mockPrisma.contractorBillingProfile.findFirst.mockResolvedValue({
        id: 'bp-1',
        isDefault: true,
      });
      mockPrisma.contractorBillingProfile.update.mockResolvedValue({});
      mockPrisma.contractorChangeRequest.update.mockResolvedValue({});

      await approveChangeRequest(REQUEST_ID, ORG_ID, REVIEWER_ID);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.contractorBillingProfile.update).toHaveBeenCalledWith({
        where: { id: 'bp-1' },
        data: expect.objectContaining({
          bankName: 'Updated Bank',
          swiftBic: 'SWIFT123',
        }),
      });
    });

    it('sets status to APPROVED with reviewerId and reviewedAt', async () => {
      mockPrisma.contractorChangeRequest.findFirst.mockResolvedValue({
        id: REQUEST_ID,
        status: 'PENDING',
        contractorId: CONTRACTOR_ID,
        requestedChanges: { bankName: 'Bank' },
      });
      mockPrisma.contractorBillingProfile.findFirst.mockResolvedValue({
        id: 'bp-1',
        isDefault: true,
      });
      mockPrisma.contractorBillingProfile.update.mockResolvedValue({});
      mockPrisma.contractorChangeRequest.update.mockResolvedValue({});

      await approveChangeRequest(REQUEST_ID, ORG_ID, REVIEWER_ID);

      expect(mockPrisma.contractorChangeRequest.update).toHaveBeenCalledWith({
        where: { id: REQUEST_ID },
        data: expect.objectContaining({
          status: 'APPROVED',
          reviewedById: REVIEWER_ID,
          reviewedAt: expect.any(Date),
        }),
      });
    });

    it('stores optional reviewer comment', async () => {
      mockPrisma.contractorChangeRequest.findFirst.mockResolvedValue({
        id: REQUEST_ID,
        status: 'PENDING',
        contractorId: CONTRACTOR_ID,
        requestedChanges: { bankName: 'Bank' },
      });
      mockPrisma.contractorBillingProfile.findFirst.mockResolvedValue({
        id: 'bp-1',
        isDefault: true,
      });
      mockPrisma.contractorBillingProfile.update.mockResolvedValue({});
      mockPrisma.contractorChangeRequest.update.mockResolvedValue({});

      await approveChangeRequest(REQUEST_ID, ORG_ID, REVIEWER_ID, 'Verified with accounting team');

      expect(mockPrisma.contractorChangeRequest.update).toHaveBeenCalledWith({
        where: { id: REQUEST_ID },
        data: expect.objectContaining({
          reviewComment: 'Verified with accounting team',
        }),
      });
    });

    it('throws NOT_FOUND for non-existent or already-reviewed request', async () => {
      mockPrisma.contractorChangeRequest.findFirst.mockResolvedValue(null);

      await expect(approveChangeRequest(REQUEST_ID, ORG_ID, REVIEWER_ID)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('throws NOT_FOUND when billing profile does not exist', async () => {
      mockPrisma.contractorChangeRequest.findFirst.mockResolvedValue({
        id: REQUEST_ID,
        status: 'PENDING',
        contractorId: CONTRACTOR_ID,
        requestedChanges: { bankName: 'Bank' },
      });
      mockPrisma.contractorBillingProfile.findFirst.mockResolvedValue(null);

      await expect(approveChangeRequest(REQUEST_ID, ORG_ID, REVIEWER_ID)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('rejectChangeRequest', () => {
    it('sets status to REJECTED with reviewerId and reviewedAt', async () => {
      mockPrisma.contractorChangeRequest.findFirst.mockResolvedValue({
        id: REQUEST_ID,
        status: 'PENDING',
      });
      mockPrisma.contractorChangeRequest.update.mockResolvedValue({});

      await rejectChangeRequest(REQUEST_ID, ORG_ID, REVIEWER_ID);

      expect(mockPrisma.contractorChangeRequest.update).toHaveBeenCalledWith({
        where: { id: REQUEST_ID },
        data: expect.objectContaining({
          status: 'REJECTED',
          reviewedById: REVIEWER_ID,
          reviewedAt: expect.any(Date),
        }),
      });
    });

    it('stores optional rejection comment', async () => {
      mockPrisma.contractorChangeRequest.findFirst.mockResolvedValue({
        id: REQUEST_ID,
        status: 'PENDING',
      });
      mockPrisma.contractorChangeRequest.update.mockResolvedValue({});

      await rejectChangeRequest(REQUEST_ID, ORG_ID, REVIEWER_ID, 'Documents not verified');

      expect(mockPrisma.contractorChangeRequest.update).toHaveBeenCalledWith({
        where: { id: REQUEST_ID },
        data: expect.objectContaining({
          reviewComment: 'Documents not verified',
        }),
      });
    });

    it('throws NOT_FOUND for non-existent or already-reviewed request', async () => {
      mockPrisma.contractorChangeRequest.findFirst.mockResolvedValue(null);

      await expect(rejectChangeRequest(REQUEST_ID, ORG_ID, REVIEWER_ID)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });
});
