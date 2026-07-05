// Pins the offboarding-template seeding wired into the organization plugin's
// `afterCreateOrganization` hook (`packages/auth/src/config.ts`).
//
// Contract under test:
//   - a freshly-created org materialises its `WorkflowRoleTemplate` seed rows
//     (the hook delegates to `upsertSeedTemplates` for that org id)
//   - the seed is NON-fatal: a failed upsert must not surface as a create error
//     (Better Auth does not roll the org back on an `afterCreate` throw)
//
// Convention (mirrors org-creation-region.test.ts / config.test.ts): exercise
// the exported `seedOrganizationDefaults` delegate against a mocked seed +
// prisma instead of booting the full Better Auth server.

import { describe, expect, it, vi } from 'vitest';

// Mock heavy dependencies to avoid spinning up a full auth server.
vi.mock('@contractor-ops/db', () => ({
  prisma: {
    user: { findUnique: vi.fn(), updateMany: vi.fn() },
    userPinnedView: { create: vi.fn() },
    workflowRoleTemplate: { upsert: vi.fn() },
  },
}));

vi.mock('@contractor-ops/offboarding-templates', () => ({
  upsertSeedTemplates: vi.fn(),
}));

vi.mock('better-auth/next-js', () => ({
  nextCookies: vi.fn(() => ({ id: 'next-cookies' })),
}));

describe('organization creation → offboarding seed templates', () => {
  it('upserts the seed templates for the newly-created org (hook fires seeding)', async () => {
    const { prisma } = await import('@contractor-ops/db');
    const { upsertSeedTemplates } = await import('@contractor-ops/offboarding-templates');
    const { seedOrganizationDefaults } = await import('../config.js');
    const upsertMock = upsertSeedTemplates as unknown as ReturnType<typeof vi.fn>;
    upsertMock.mockReset();
    upsertMock.mockResolvedValueOnce(undefined);

    await seedOrganizationDefaults('org_abc');

    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledWith(prisma, 'org_abc');
  });

  it('is non-fatal when the seed upsert fails (org creation must not roll back)', async () => {
    const { upsertSeedTemplates } = await import('@contractor-ops/offboarding-templates');
    const { seedOrganizationDefaults } = await import('../config.js');
    const upsertMock = upsertSeedTemplates as unknown as ReturnType<typeof vi.fn>;
    upsertMock.mockReset();
    upsertMock.mockRejectedValueOnce(new Error('db down'));

    await expect(seedOrganizationDefaults('org_xyz')).resolves.toBeUndefined();
  });
});
