import { beforeEach, describe, expect, it, vi } from 'vitest';

// Magic-link employee resolution: findEmployeesByEmail resolves ACTIVE
// Worker(EMPLOYEE) rows by normalized email and excludes TERMINATED/deleted;
// a shared email resolves BOTH a contractor and an employee subject (the union
// the org-picker presents). Mock-prisma harness (no live DB).

const { mockWorkerFindMany, mockContractorFindMany } = vi.hoisted(() => ({
  mockWorkerFindMany: vi.fn(),
  mockContractorFindMany: vi.fn(),
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    worker: { findMany: mockWorkerFindMany },
    contractor: { findMany: mockContractorFindMany },
  },
}));

vi.mock('../app-email', () => ({ sendAppEmail: vi.fn() }));

import { findContractorsByEmail, findEmployeesByEmail } from '../portal-magic-link';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('findEmployeesByEmail', () => {
  it('queries ACTIVE employee workers by normalized (lowercased, trimmed) email', async () => {
    mockWorkerFindMany.mockResolvedValueOnce([]);

    await findEmployeesByEmail('  Empl@X.org ');

    expect(mockWorkerFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workerType: 'EMPLOYEE',
          email: 'empl@x.org',
          deletedAt: null,
        }),
      }),
    );
  });

  it('excludes TERMINATED employees from the resolved subjects', async () => {
    mockWorkerFindMany.mockResolvedValueOnce([
      {
        id: 'w_active',
        organizationId: 'org_a',
        organization: { id: 'org_a', name: 'A', logo: null },
        employeeProfile: { employmentStatus: 'ACTIVE' },
      },
      {
        id: 'w_term',
        organizationId: 'org_a',
        organization: { id: 'org_a', name: 'A', logo: null },
        employeeProfile: { employmentStatus: 'TERMINATED' },
      },
    ]);

    const result = await findEmployeesByEmail('e@x.org');

    expect(result.map(w => w.id)).toEqual(['w_active']);
  });
});

describe('shared email resolves BOTH subjects (the union)', () => {
  it('resolves a contractor AND an employee for the same email', async () => {
    mockContractorFindMany.mockResolvedValueOnce([
      { id: 'c_1', organizationId: 'org_a', organization: { id: 'org_a', name: 'A', logo: null } },
    ]);
    mockWorkerFindMany.mockResolvedValueOnce([
      {
        id: 'w_1',
        organizationId: 'org_b',
        organization: { id: 'org_b', name: 'B', logo: null },
        employeeProfile: { employmentStatus: 'ACTIVE' },
      },
    ]);

    const [contractors, employees] = await Promise.all([
      findContractorsByEmail('shared@x.org'),
      findEmployeesByEmail('shared@x.org'),
    ]);

    expect(contractors.map(c => c.id)).toEqual(['c_1']);
    expect(employees.map(w => w.id)).toEqual(['w_1']);
    // The union verifyMagicLink composes = one CONTRACTOR + one EMPLOYEE subject.
    expect(contractors.length + employees.length).toBe(2);
  });
});
