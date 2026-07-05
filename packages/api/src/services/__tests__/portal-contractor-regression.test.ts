import { beforeEach, describe, expect, it, vi } from 'vitest';

// Regression fence: the CONTRACTOR portal path must be byte-for-byte unchanged by
// the subject-discrimination work. A contractor session validates to the
// CONTRACTOR branch with the same contractor payload + status gate, and no
// worker/workerId ever leaks into a contractor result.

const { mockSessionCreate, mockSessionFindUnique } = vi.hoisted(() => ({
  mockSessionCreate: vi.fn(),
  mockSessionFindUnique: vi.fn(),
}));

vi.mock('@contractor-ops/db', () => {
  const MockDbPrisma = {
    portalSession: {
      create: mockSessionCreate,
      findUnique: mockSessionFindUnique,
      deleteMany: vi.fn(),
    },
  };
  return {
    withRlsTransactions: <T>(c: T) => c,
    withRlsReads: <T>(c: T) => c,
    prisma: MockDbPrisma,
    prismaRaw: MockDbPrisma,
  };
});

import { createPortalSession, validatePortalSession } from '../portal-session';

beforeEach(() => {
  vi.clearAllMocks();
});

const futureDate = new Date(Date.now() + 86400000);

describe('contractor path — validatePortalSession', () => {
  it('resolves the CONTRACTOR branch with the contractor payload and no worker leak', async () => {
    const contractor = { id: 'contractor_1', displayName: 'Acme Co', status: 'ACTIVE' };
    mockSessionFindUnique.mockResolvedValueOnce({
      id: 'session_con',
      subjectType: 'CONTRACTOR',
      contractorId: 'contractor_1',
      workerId: null,
      expiresAt: futureDate,
      contractor,
      worker: null,
    });

    const result = await validatePortalSession('raw');

    expect(result).not.toBeNull();
    expect(result?.subjectType).toBe('CONTRACTOR');
    // The contractor payload is preserved exactly.
    if (result?.subjectType === 'CONTRACTOR') {
      expect(result.contractor).toBe(contractor);
    }
    // No employee subject leaks into a contractor result.
    expect((result as { workerId?: string | null }).workerId).toBeNull();
    expect((result as { worker?: unknown }).worker).toBeNull();
  });

  it('still rejects an ARCHIVED contractor', async () => {
    mockSessionFindUnique.mockResolvedValueOnce({
      id: 'session_archived',
      subjectType: 'CONTRACTOR',
      expiresAt: futureDate,
      contractor: { status: 'ARCHIVED' },
      worker: null,
    });
    expect(await validatePortalSession('raw')).toBeNull();
  });

  it('still rejects an INACTIVE contractor', async () => {
    mockSessionFindUnique.mockResolvedValueOnce({
      id: 'session_inactive',
      subjectType: 'CONTRACTOR',
      expiresAt: futureDate,
      contractor: { status: 'INACTIVE' },
      worker: null,
    });
    expect(await validatePortalSession('raw')).toBeNull();
  });
});

describe('contractor path — createPortalSession', () => {
  it('writes the same contractor row shape (contractorId set, workerId null)', async () => {
    mockSessionCreate.mockResolvedValueOnce({ id: 'session_con' });

    await createPortalSession({
      subjectType: 'CONTRACTOR',
      contractorId: 'contractor_1',
      organizationId: 'org_1',
      email: 'contractor@example.com',
    });

    const data = mockSessionCreate.mock.calls[0][0].data;
    expect(data.contractorId).toBe('contractor_1');
    expect(data.workerId).toBeNull();
    expect(data.subjectType).toBe('CONTRACTOR');
  });
});
