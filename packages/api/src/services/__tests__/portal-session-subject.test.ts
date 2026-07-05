import { beforeEach, describe, expect, it, vi } from 'vitest';

// Discrimination + one-of invariant for the EMPLOYEE portal subject. Mirrors the
// mock-prisma harness of portal-session.test.ts (no live DB — the DB CHECK is
// simulated by a rejecting create mock).

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

describe('createPortalSession — one-of subject shape', () => {
  it('writes an EMPLOYEE row with workerId set and contractorId null', async () => {
    mockSessionCreate.mockResolvedValueOnce({ id: 'session_emp' });

    await createPortalSession({
      subjectType: 'EMPLOYEE',
      workerId: 'worker_1',
      organizationId: 'org_1',
      email: 'employee@example.com',
    });

    expect(mockSessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subjectType: 'EMPLOYEE',
        workerId: 'worker_1',
        contractorId: null,
        organizationId: 'org_1',
      }),
    });
  });

  it('writes a CONTRACTOR row with contractorId set and workerId null', async () => {
    mockSessionCreate.mockResolvedValueOnce({ id: 'session_con' });

    await createPortalSession({
      subjectType: 'CONTRACTOR',
      contractorId: 'contractor_1',
      organizationId: 'org_1',
      email: 'contractor@example.com',
    });

    expect(mockSessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subjectType: 'CONTRACTOR',
        contractorId: 'contractor_1',
        workerId: null,
      }),
    });
  });

  it('propagates a DB rejection (the one-of CHECK) rather than swallowing it', async () => {
    // The row would violate PortalSession_subject_one_of; the DB rejects it and
    // the service surfaces the error.
    mockSessionCreate.mockRejectedValueOnce(
      new Error('new row for relation "PortalSession" violates check constraint'),
    );

    await expect(
      createPortalSession({
        subjectType: 'EMPLOYEE',
        workerId: 'worker_1',
        organizationId: 'org_1',
        email: 'employee@example.com',
      }),
    ).rejects.toThrow(/check constraint/);
  });
});

describe('validatePortalSession — EMPLOYEE subject', () => {
  const futureDate = new Date(Date.now() + 86400000);

  it('resolves the EMPLOYEE branch with the loaded worker + profile', async () => {
    const worker = {
      id: 'worker_1',
      deletedAt: null,
      employeeProfile: { employmentStatus: 'ACTIVE' },
    };
    mockSessionFindUnique.mockResolvedValueOnce({
      id: 'session_emp',
      subjectType: 'EMPLOYEE',
      expiresAt: futureDate,
      contractor: null,
      worker,
    });

    const result = await validatePortalSession('raw');

    expect(result).toMatchObject({
      subjectType: 'EMPLOYEE',
      worker,
      employeeProfile: { employmentStatus: 'ACTIVE' },
    });
  });

  it('returns null for a TERMINATED employee', async () => {
    mockSessionFindUnique.mockResolvedValueOnce({
      id: 'session_term',
      subjectType: 'EMPLOYEE',
      expiresAt: futureDate,
      contractor: null,
      worker: {
        id: 'worker_1',
        deletedAt: null,
        employeeProfile: { employmentStatus: 'TERMINATED' },
      },
    });

    expect(await validatePortalSession('raw')).toBeNull();
  });

  it('returns null for a soft-deleted worker', async () => {
    mockSessionFindUnique.mockResolvedValueOnce({
      id: 'session_deleted',
      subjectType: 'EMPLOYEE',
      expiresAt: futureDate,
      contractor: null,
      worker: {
        id: 'worker_1',
        deletedAt: new Date(),
        employeeProfile: { employmentStatus: 'ACTIVE' },
      },
    });

    expect(await validatePortalSession('raw')).toBeNull();
  });
});
