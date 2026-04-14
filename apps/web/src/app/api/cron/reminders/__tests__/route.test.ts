/** @vitest-environment node */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockReminderFindMany,
  mockWorkflowTaskFindMany,
  mockNotificationFindFirst,
  mockContractFindMany,
  mockReminderInstanceFindFirst,
  mockReminderInstanceCreate,
  mockReminderInstanceUpdateMany,
} = vi.hoisted(() => ({
  mockReminderFindMany: vi.fn(),
  mockWorkflowTaskFindMany: vi.fn(),
  mockNotificationFindFirst: vi.fn(),
  mockContractFindMany: vi.fn(),
  mockReminderInstanceFindFirst: vi.fn(),
  mockReminderInstanceCreate: vi.fn(),
  mockReminderInstanceUpdateMany: vi.fn(),
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    reminderRule: {
      findMany: mockReminderFindMany,
    },
    contract: {
      findMany: mockContractFindMany,
    },
    invoice: { findMany: vi.fn().mockResolvedValue([]) },
    reminderInstance: {
      findFirst: mockReminderInstanceFindFirst,
      create: mockReminderInstanceCreate,
      updateMany: mockReminderInstanceUpdateMany,
    },
    workflowTaskRun: {
      findMany: mockWorkflowTaskFindMany,
    },
    notification: {
      findFirst: mockNotificationFindFirst,
    },
  },
}));

vi.mock('@contractor-ops/api/services/notification-service', () => ({
  dispatch: mockDispatch,
}));

vi.mock('@sentry/nextjs', () => ({
  withMonitor: vi.fn((_name: string, fn: () => Promise<Response>) => fn()),
  captureException: vi.fn(),
}));

vi.mock('@contractor-ops/api/services/cron-monitor', () => ({
  withCronMonitor: vi.fn((_name: string, fn: () => Promise<Response>) => fn()),
}));

vi.mock('@contractor-ops/logger', () => ({
  createCronLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { gauge: vi.fn(), increment: vi.fn() },
}));

import { GET } from '../route';

const { mockDispatch } = vi.hoisted(() => ({
  mockDispatch: vi.fn(),
}));

describe('GET /api/cron/reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReminderFindMany.mockResolvedValue([]);
    mockWorkflowTaskFindMany.mockResolvedValue([]);
    mockNotificationFindFirst.mockResolvedValue(null);
    mockContractFindMany.mockResolvedValue([]);
    mockReminderInstanceFindFirst.mockResolvedValue(null);
    mockReminderInstanceCreate.mockResolvedValue({});
    mockReminderInstanceUpdateMany.mockResolvedValue({ count: 1 });
    mockDispatch.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 401 when CRON_SECRET is set but Authorization is wrong', async () => {
    process.env.CRON_SECRET = 'secret-cron';
    const req = new NextRequest('http://localhost/api/cron/reminders', {
      headers: { authorization: 'Bearer wrong' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 when CRON_SECRET is missing', async () => {
    delete process.env.CRON_SECRET;
    const req = new NextRequest('http://localhost/api/cron/reminders');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with payload when Bearer token matches CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'good-secret';
    const req = new NextRequest('http://localhost/api/cron/reminders', {
      headers: { authorization: 'Bearer good-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      processed: number;
      sent: number;
      overdueTasksNotified: number;
    };
    expect(json).toMatchObject({
      processed: 0,
      sent: 0,
      overdueTasksNotified: 0,
    });
  });

  it('evaluates BEFORE_CONTRACT_END rule: creates instance, dispatches, marks SENT', async () => {
    vi.useFakeTimers({ now: new Date('2026-06-15T12:00:00.000Z') });

    mockReminderFindMany.mockResolvedValue([
      {
        id: 'rule-contract-1',
        active: true,
        organizationId: 'org-1',
        offsetDays: 7,
        triggerType: 'BEFORE_CONTRACT_END',
        entityType: 'CONTRACT',
        recipientMode: 'SPECIFIC_USER',
        configJson: { userId: 'user-notify-1' },
      },
    ]);

    mockContractFindMany.mockResolvedValue([
      {
        id: 'contract-1',
        title: 'MSA 2026',
        contractorId: 'contractor-1',
        organizationId: 'org-1',
        endDate: new Date('2026-06-20T00:00:00.000Z'),
      },
    ]);

    process.env.CRON_SECRET = 'good-secret';
    const req = new NextRequest('http://localhost/api/cron/reminders', {
      headers: { authorization: 'Bearer good-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      processed: number;
      sent: number;
    };
    expect(json.processed).toBe(1);
    expect(json.sent).toBe(1);

    expect(mockReminderInstanceCreate).toHaveBeenCalled();
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        type: 'CONTRACT_EXPIRING',
        recipientUserIds: ['user-notify-1'],
        entityId: 'contract-1',
      }),
    );
    expect(mockReminderInstanceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SENT' }),
      }),
    );
  });

  it('skips dispatch when reminder instance already exists (dedup)', async () => {
    vi.useFakeTimers({ now: new Date('2026-06-15T12:00:00.000Z') });

    mockReminderFindMany.mockResolvedValue([
      {
        id: 'rule-dedup',
        active: true,
        organizationId: 'org-1',
        offsetDays: 7,
        triggerType: 'BEFORE_CONTRACT_END',
        entityType: 'CONTRACT',
        recipientMode: 'SPECIFIC_USER',
        configJson: { userId: 'user-notify-1' },
      },
    ]);

    mockContractFindMany.mockResolvedValue([
      {
        id: 'contract-dedup',
        title: 'C',
        contractorId: 'c1',
        organizationId: 'org-1',
        endDate: new Date('2026-06-18T00:00:00.000Z'),
      },
    ]);

    mockReminderInstanceFindFirst.mockResolvedValue({ id: 'existing-instance' });

    process.env.CRON_SECRET = 'good-secret';
    const res = await GET(
      new NextRequest('http://localhost/api/cron/reminders', {
        headers: { authorization: 'Bearer good-secret' },
      }),
    );
    const json = (await res.json()) as { processed: number; sent: number };
    expect(json.processed).toBe(1);
    expect(json.sent).toBe(0);
    expect(mockReminderInstanceCreate).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
