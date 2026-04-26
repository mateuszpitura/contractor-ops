// ---------------------------------------------------------------------------
// DRV § 7a SGB IV clearance-expiry reminder tests — Phase 60 CLASS-09.
// ---------------------------------------------------------------------------
//
// Exercises detectDrvClearanceExpiries() which piggybacks on the existing
// /api/cron/reminders cron (D-11 — NOT a new cron). Covers VALIDATION.md rows
// 60-03-03 (90/30/7 day bands + off-by-one boundaries) and 60-03-04 (one-shot
// dedup + outcome filter + recipient resolution).

import { beforeEach, describe, expect, it, vi } from 'vitest';

type ClearanceRow = {
  id: string;
  organizationId: string;
  contractorAssignmentId: string;
  validTo: Date | null;
  outcome: 'PENDING' | 'SELBSTANDIG' | 'ABHANGIG' | 'WITHDRAWN';
  drvReference: string;
  contractorAssignment?: { id: string };
};

type NotificationRow = {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
};

const { mockPrisma, clearances, notifications, dispatchMock, resolveRbacMock } = vi.hoisted(() => {
  const clearances: ClearanceRow[] = [];
  const notifications: NotificationRow[] = [];
  const dispatchMock = vi.fn(async () => undefined);
  const resolveRbacMock = vi.fn(async () => ['user-1', 'user-2']);

  const mockPrisma = {
    statusfeststellungsverfahren: {
      findMany: vi.fn(
        async (args: {
          where?: {
            validTo?: { gte?: Date; lt?: Date };
            outcome?: { in?: string[] };
          };
        }) => {
          const where = args?.where ?? {};
          return clearances.filter(c => {
            if (where.outcome?.in && !where.outcome.in.includes(c.outcome)) {
              return false;
            }
            if (where.validTo?.gte && c.validTo && c.validTo < where.validTo.gte) {
              return false;
            }
            if (where.validTo?.lt && c.validTo && c.validTo >= where.validTo.lt) {
              return false;
            }
            if (!c.validTo) return false;
            return true;
          });
        },
      ),
    },
    notification: {
      findFirst: vi.fn(
        async (args: { where: { type: string; entityType: string; entityId: string } }) => {
          return (
            notifications.find(
              n =>
                n.type === args.where.type &&
                n.entityType === args.where.entityType &&
                n.entityId === args.where.entityId,
            ) ?? null
          );
        },
      ),
    },
    // Existing cron helpers require these:
    reminderRule: { findMany: vi.fn(async () => []) },
    reminderInstance: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: 'ri-1' })),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    workflowTaskRun: { findMany: vi.fn(async () => []) },
    member: { findMany: vi.fn(async () => []) },
    contract: { findMany: vi.fn(async () => []) },
    invoice: { findMany: vi.fn(async () => []) },
  };
  return { mockPrisma, clearances, notifications, dispatchMock, resolveRbacMock };
});

vi.mock('@contractor-ops/db', () => ({
  prisma: mockPrisma,
  prismaRaw: mockPrisma,
  tenantStore: {
    run: (_ctx: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(() => ({ region: 'EU' })),
  },
  createTenantClientFrom: vi.fn(() => mockPrisma),
  getRegionalClient: vi.fn(() => mockPrisma),
}));

vi.mock('@contractor-ops/api/services/notification-service', () => ({
  dispatch: dispatchMock,
}));

vi.mock('@contractor-ops/api/services/rbac-recipients', () => ({
  resolveRbacRecipients: resolveRbacMock,
}));

vi.mock('@contractor-ops/api/services/cron-monitor', () => ({
  withCronMonitor: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
}));

vi.mock('@sentry/nextjs', () => ({
  withMonitor: vi.fn((_name: string, fn: () => Promise<unknown>) => fn()),
  captureException: vi.fn(),
}));

vi.mock('@contractor-ops/logger', () => ({
  createCronLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { gauge: vi.fn(), increment: vi.fn(), distribution: vi.fn() },
}));

// Import after mocks.
const { detectDrvClearanceExpiries } = await import('../drv-clearance-expiries.js');

function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const r = new Date(date);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

beforeEach(() => {
  clearances.length = 0;
  notifications.length = 0;
  dispatchMock.mockClear();
  resolveRbacMock.mockClear();
  resolveRbacMock.mockResolvedValue(['user-1', 'user-2']);
});

describe('detectDrvClearanceExpiries — 90/30/7 day bands (60-03-03)', () => {
  it('fires exactly at 90d for SELBSTANDIG clearance', async () => {
    const today = startOfTodayUtc();
    clearances.push({
      id: 'c-90',
      organizationId: 'org-1',
      contractorAssignmentId: 'ca-1',
      validTo: addDays(today, 90),
      outcome: 'SELBSTANDIG',
      drvReference: 'DRV-90',
    });

    const sent = await detectDrvClearanceExpiries();

    expect(sent).toBe(1);
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    const args = dispatchMock.mock.calls[0][0];
    expect(args.type).toBe('classification.drv_expiry_90d');
    expect(args.entityType).toBe('CONTRACTOR');
    expect(args.entityId).toBe('c-90');
  });

  it('fires exactly at 30d for ABHANGIG clearance', async () => {
    const today = startOfTodayUtc();
    clearances.push({
      id: 'c-30',
      organizationId: 'org-1',
      contractorAssignmentId: 'ca-1',
      validTo: addDays(today, 30),
      outcome: 'ABHANGIG',
      drvReference: 'DRV-30',
    });

    const sent = await detectDrvClearanceExpiries();

    expect(sent).toBe(1);
    expect(dispatchMock.mock.calls[0][0].type).toBe('classification.drv_expiry_30d');
  });

  it('fires exactly at 7d', async () => {
    const today = startOfTodayUtc();
    clearances.push({
      id: 'c-7',
      organizationId: 'org-1',
      contractorAssignmentId: 'ca-1',
      validTo: addDays(today, 7),
      outcome: 'SELBSTANDIG',
      drvReference: 'DRV-7',
    });

    const sent = await detectDrvClearanceExpiries();

    expect(sent).toBe(1);
    expect(dispatchMock.mock.calls[0][0].type).toBe('classification.drv_expiry_7d');
  });

  it('does NOT fire for 91d or 89d (off-by-one guard on 90d band)', async () => {
    const today = startOfTodayUtc();
    clearances.push({
      id: 'c-91',
      organizationId: 'org-1',
      contractorAssignmentId: 'ca-1',
      validTo: addDays(today, 91),
      outcome: 'SELBSTANDIG',
      drvReference: 'DRV-91',
    });
    clearances.push({
      id: 'c-89',
      organizationId: 'org-1',
      contractorAssignmentId: 'ca-1',
      validTo: addDays(today, 89),
      outcome: 'SELBSTANDIG',
      drvReference: 'DRV-89',
    });

    const sent = await detectDrvClearanceExpiries();

    expect(sent).toBe(0);
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});

describe('detectDrvClearanceExpiries — one-shot dedup (60-03-04)', () => {
  it('skips clearance with an existing Notification for the same (type, entityId)', async () => {
    const today = startOfTodayUtc();
    clearances.push({
      id: 'c-dedup',
      organizationId: 'org-1',
      contractorAssignmentId: 'ca-1',
      validTo: addDays(today, 90),
      outcome: 'SELBSTANDIG',
      drvReference: 'DRV-DEDUP',
    });
    notifications.push({
      id: 'n-prev',
      type: 'classification.drv_expiry_90d',
      entityType: 'CONTRACTOR',
      entityId: 'c-dedup',
    });

    const sent = await detectDrvClearanceExpiries();

    expect(sent).toBe(0);
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});

describe('detectDrvClearanceExpiries — outcome filter (60-03-04)', () => {
  it('skips PENDING + WITHDRAWN outcomes regardless of validTo proximity', async () => {
    const today = startOfTodayUtc();
    clearances.push({
      id: 'c-pending',
      organizationId: 'org-1',
      contractorAssignmentId: 'ca-1',
      validTo: addDays(today, 90),
      outcome: 'PENDING',
      drvReference: 'DRV-PENDING',
    });
    clearances.push({
      id: 'c-withdrawn',
      organizationId: 'org-1',
      contractorAssignmentId: 'ca-2',
      validTo: addDays(today, 7),
      outcome: 'WITHDRAWN',
      drvReference: 'DRV-WITHDRAWN',
    });

    const sent = await detectDrvClearanceExpiries();

    expect(sent).toBe(0);
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});

describe('detectDrvClearanceExpiries — recipient resolution (60-03-04)', () => {
  it('uses resolveRbacRecipients(orgId, "contractor:read") for dispatch', async () => {
    const today = startOfTodayUtc();
    clearances.push({
      id: 'c-rec',
      organizationId: 'org-recipient',
      contractorAssignmentId: 'ca-1',
      validTo: addDays(today, 30),
      outcome: 'SELBSTANDIG',
      drvReference: 'DRV-REC',
    });

    await detectDrvClearanceExpiries();

    expect(resolveRbacMock).toHaveBeenCalledWith('org-recipient', 'contractor:read');
    const args = dispatchMock.mock.calls[0][0];
    expect(args.recipientUserIds).toEqual(['user-1', 'user-2']);
  });

  it('skips dispatch when no recipients resolve (empty fallback)', async () => {
    resolveRbacMock.mockResolvedValueOnce([]);
    const today = startOfTodayUtc();
    clearances.push({
      id: 'c-empty-rec',
      organizationId: 'org-1',
      contractorAssignmentId: 'ca-1',
      validTo: addDays(today, 90),
      outcome: 'SELBSTANDIG',
      drvReference: 'DRV-EMPTY',
    });

    const sent = await detectDrvClearanceExpiries();

    expect(sent).toBe(0);
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});
