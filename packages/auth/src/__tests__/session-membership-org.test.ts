// Exercises the real `databaseHooks.session.{create,update}.before` hooks from
// `packages/auth/src/config.ts`. These hooks run inside Better Auth's session
// lifecycle; they are plain async functions on the options object, so we invoke
// them directly with a synthetic session payload and a mocked prisma.
//
// Contracts under test:
//   3. A soft-disabled active membership (`Member.disabledAt` set) cannot
//      create OR refresh a session — both hooks throw UNAUTHORIZED.
//   4. A new user with no active org is auto-seeded to their first non-disabled
//      membership on session.create (so tenant-scoped tRPC never throws
//      `tenantNoActiveOrganization`); a user with genuinely zero memberships is
//      left without an active org (routed to onboarding) rather than rejected.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    user: { findUnique: vi.fn(), updateMany: vi.fn() },
    member: { findFirst: vi.fn() },
    userPinnedView: { create: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('better-auth/next-js', () => ({
  nextCookies: vi.fn(() => ({ id: 'next-cookies' })),
}));

type SessionInput = {
  userId?: string;
  activeOrganizationId?: string | null;
  [key: string]: unknown;
};

async function getSessionHooks() {
  const { auth } = await import('../config.js');
  const create = auth.options.databaseHooks?.session?.create?.before;
  const update = auth.options.databaseHooks?.session?.update?.before;
  if (typeof create !== 'function' || typeof update !== 'function') {
    throw new Error('expected session create/update before hooks to be callable');
  }
  return { create, update } as {
    create: (s: SessionInput) => Promise<{ data: SessionInput }>;
    update: (s: SessionInput) => Promise<{ data: SessionInput }>;
  };
}

let prismaMock: { member: { findFirst: ReturnType<typeof vi.fn> } };

beforeEach(async () => {
  const db = await import('@contractor-ops/db');
  prismaMock = db.prisma as never;
  prismaMock.member.findFirst.mockReset();
});

describe('disabled membership blocks session create/refresh', () => {
  it('rejects session.create when the active membership is disabled', async () => {
    prismaMock.member.findFirst.mockResolvedValueOnce({
      id: 'mem_1',
      disabledAt: new Date('2026-01-01T00:00:00Z'),
    });
    const { create } = await getSessionHooks();

    await expect(create({ userId: 'usr_1', activeOrganizationId: 'org_1' })).rejects.toMatchObject({
      status: 'UNAUTHORIZED',
    });
  });

  it('rejects session.update (refresh / setActiveOrganization) for a disabled membership', async () => {
    prismaMock.member.findFirst.mockResolvedValueOnce({
      id: 'mem_1',
      disabledAt: new Date('2026-01-01T00:00:00Z'),
    });
    const { update } = await getSessionHooks();

    await expect(update({ userId: 'usr_1', activeOrganizationId: 'org_1' })).rejects.toMatchObject({
      status: 'UNAUTHORIZED',
    });
  });

  it('allows session.create when the active membership is NOT disabled', async () => {
    prismaMock.member.findFirst.mockResolvedValueOnce({ id: 'mem_1', disabledAt: null });
    const { create } = await getSessionHooks();

    const result = await create({ userId: 'usr_1', activeOrganizationId: 'org_1' });
    expect(result.data.activeOrganizationId).toBe('org_1');
  });

  it('skips the disabled check on session.update when the payload carries no activeOrganizationId', async () => {
    const { update } = await getSessionHooks();

    await expect(update({ userId: 'usr_1' })).resolves.toBeDefined();
    expect(prismaMock.member.findFirst).not.toHaveBeenCalled();
  });
});

describe('new-user org routing on session.create (no tenantNoActiveOrganization)', () => {
  it('auto-seeds activeOrganizationId to the first non-disabled membership when none is set', async () => {
    // First findFirst call = seed lookup (orderBy createdAt asc, disabledAt null).
    prismaMock.member.findFirst.mockResolvedValueOnce({ organizationId: 'org_first' });
    // Second findFirst call = the disabled-membership assertion on the seeded org.
    prismaMock.member.findFirst.mockResolvedValueOnce({ id: 'mem_first', disabledAt: null });
    const { create } = await getSessionHooks();

    const result = await create({ userId: 'usr_new', activeOrganizationId: null });

    expect(result.data.activeOrganizationId).toBe('org_first');
    // The seed query filters to non-disabled memberships ordered oldest-first.
    expect(prismaMock.member.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'usr_new', disabledAt: null },
        orderBy: { createdAt: 'asc' },
      }),
    );
  });

  it('leaves a brand-new org-less user without an active org (routed to onboarding, not rejected)', async () => {
    // No memberships at all → seed lookup returns null; the assertion no-ops
    // because there is no activeOrganizationId to check. The hook must RESOLVE
    // (so the session is created and the user reaches onboarding) and must NOT
    // throw tenantNoActiveOrganization.
    prismaMock.member.findFirst.mockResolvedValueOnce(null);
    const { create } = await getSessionHooks();

    const result = await create({ userId: 'usr_orgless', activeOrganizationId: null });

    expect(result.data.activeOrganizationId).toBeFalsy();
    expect(prismaMock.member.findFirst).toHaveBeenCalledTimes(1); // seed only; no assertion query
  });

  it('does not overwrite an activeOrganizationId the user already picked', async () => {
    // A multi-org user who already has an active org: the seed branch is skipped
    // (only the disabled-membership assertion runs), so their choice is kept.
    prismaMock.member.findFirst.mockResolvedValueOnce({ id: 'mem_picked', disabledAt: null });
    const { create } = await getSessionHooks();

    const result = await create({ userId: 'usr_multi', activeOrganizationId: 'org_picked' });

    expect(result.data.activeOrganizationId).toBe('org_picked');
    // Single call = the assertion only; no seed lookup happened.
    expect(prismaMock.member.findFirst).toHaveBeenCalledTimes(1);
  });
});
