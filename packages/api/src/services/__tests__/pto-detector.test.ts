// Phase 74 Plan 06 — GREEN tests for resolveAssigneeWithPto.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarAdapter } from '../pto-detector';
import { isManagerOnPto, resolveAssigneeWithPto } from '../pto-detector';

const TODAY = new Date('2026-05-10T12:00:00Z');

function makePrisma(
  overrides: {
    user?: { outOfOffice?: unknown } | null;
    team?: { fallbackApproverId: string | null } | null;
    ownerMember?: { userId: string } | null;
  } = {},
) {
  return {
    user: {
      findUnique: vi.fn(async () => overrides.user ?? null),
    },
    team: {
      findUnique: vi.fn(async () => overrides.team ?? null),
    },
    member: {
      findFirst: vi.fn(async () => overrides.ownerMember ?? null),
    },
  };
}

function makeAdapter(
  busy: Array<{ start: string; end: string; summary?: string; isAllDay?: boolean }>,
): CalendarAdapter {
  return { getFreeBusy: vi.fn(async () => ({ busy })) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveAssigneeWithPto — D-05/D-06/D-07/D-08', () => {
  it('routes to manager when no PTO detected', async () => {
    const prisma = makePrisma({ user: { outOfOffice: null } });
    const adapter = makeAdapter([]); // empty calendar
    const result = await resolveAssigneeWithPto({
      prisma: prisma as never,
      organizationId: 'org-1',
      managerUserId: 'user-mgr',
      teamId: 'team-1',
      today: TODAY,
      calendarAdapter: adapter,
      managerCalendarAccessToken: 'tok',
    });
    expect(result.assigneeUserId).toBe('user-mgr');
    expect(result.fallbackReason).toBeUndefined();
  });

  it('routes to fallback when calendar shows all-day busy', async () => {
    const prisma = makePrisma({
      user: { outOfOffice: null },
      team: { fallbackApproverId: 'user-fallback' },
    });
    const adapter = makeAdapter([
      {
        start: '2026-05-10T00:00:00Z',
        end: '2026-05-11T00:00:00Z',
        summary: 'Out',
        isAllDay: true,
      },
    ]);
    const result = await resolveAssigneeWithPto({
      prisma: prisma as never,
      organizationId: 'org-1',
      managerUserId: 'user-mgr',
      teamId: 'team-1',
      today: TODAY,
      calendarAdapter: adapter,
      managerCalendarAccessToken: 'tok',
    });
    expect(result.assigneeUserId).toBe('user-fallback');
    expect(result.fallbackReason).toBe('manager_pto');
  });

  it('routes to fallback when User.outOfOffice is set today', async () => {
    const prisma = makePrisma({
      user: {
        outOfOffice: {
          from: '2026-05-09T00:00:00Z',
          until: '2026-05-15T00:00:00Z',
        },
      },
      team: { fallbackApproverId: 'user-team-fallback' },
    });
    const result = await resolveAssigneeWithPto({
      prisma: prisma as never,
      organizationId: 'org-1',
      managerUserId: 'user-mgr',
      teamId: 'team-1',
      today: TODAY,
      calendarAdapter: null,
    });
    expect(result.assigneeUserId).toBe('user-team-fallback');
    expect(result.fallbackReason).toBe('manager_pto');
  });

  it('honours User.outOfOffice.fallbackUserId before Team.fallbackApproverId', async () => {
    const prisma = makePrisma({
      user: {
        outOfOffice: {
          from: '2026-05-09T00:00:00Z',
          until: '2026-05-15T00:00:00Z',
          fallbackUserId: 'user-personal-deputy',
        },
      },
      team: { fallbackApproverId: 'user-team-fallback' },
    });
    const result = await resolveAssigneeWithPto({
      prisma: prisma as never,
      organizationId: 'org-1',
      managerUserId: 'user-mgr',
      teamId: 'team-1',
      today: TODAY,
      calendarAdapter: null,
    });
    expect(result.assigneeUserId).toBe('user-personal-deputy');
    expect(prisma.team.findUnique).not.toHaveBeenCalled();
  });

  it('skips calendar lookup entirely when no integration connected (D-07)', async () => {
    const prisma = makePrisma({ user: { outOfOffice: null } });
    const result = await resolveAssigneeWithPto({
      prisma: prisma as never,
      organizationId: 'org-1',
      managerUserId: 'user-mgr',
      today: TODAY,
      calendarAdapter: null,
    });
    expect(result.assigneeUserId).toBe('user-mgr');
    expect(result.fallbackReason).toBeUndefined();
  });

  it('falls through to OWNER role users + admin-attention badge when team has no fallback', async () => {
    const prisma = makePrisma({
      user: {
        outOfOffice: {
          from: '2026-05-09T00:00:00Z',
          until: '2026-05-15T00:00:00Z',
        },
      },
      team: { fallbackApproverId: null },
      ownerMember: { userId: 'user-owner' },
    });
    const result = await resolveAssigneeWithPto({
      prisma: prisma as never,
      organizationId: 'org-1',
      managerUserId: 'user-mgr',
      teamId: 'team-1',
      today: TODAY,
      calendarAdapter: null,
    });
    expect(result.assigneeUserId).toBe('user-owner');
    expect(result.fallbackReason).toBe('team_no_fallback');
    expect(result.needsAdminAttention).toBe(true);
  });

  it('detects PTO via PTO_KEYWORDS title match on timed busy', async () => {
    const prisma = makePrisma({ user: { outOfOffice: null } });
    const adapter = makeAdapter([
      {
        start: '2026-05-10T09:00:00Z',
        end: '2026-05-10T10:00:00Z',
        summary: 'Out of Office today',
        isAllDay: false,
      },
    ]);
    const check = await isManagerOnPto({
      prisma: prisma as never,
      managerUserId: 'user-mgr',
      managerLocale: 'en',
      today: TODAY,
      calendarAdapter: adapter,
      managerCalendarAccessToken: 'tok',
    });
    expect(check.pto).toBe(true);
  });

  it('no PTO-spam — single resolution at task creation time', async () => {
    // The detector exposes one entry point (resolveAssigneeWithPto). Calling
    // it once and asserting that the calendar adapter's getFreeBusy was hit
    // exactly once is sufficient — Plan 74-08's startOffboardingRun calls it
    // per-task at creation time (no per-render re-resolution).
    const prisma = makePrisma({ user: { outOfOffice: null } });
    const adapter = makeAdapter([]);
    await resolveAssigneeWithPto({
      prisma: prisma as never,
      organizationId: 'org-1',
      managerUserId: 'user-mgr',
      today: TODAY,
      calendarAdapter: adapter,
      managerCalendarAccessToken: 'tok',
    });
    expect(adapter.getFreeBusy).toHaveBeenCalledTimes(1);
  });
});
