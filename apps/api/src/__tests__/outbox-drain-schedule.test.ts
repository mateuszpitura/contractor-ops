/** @vitest-environment node */

/**
 * Boot-time assertion for the global transactional-outbox drain schedule.
 *
 * Coverage:
 *   1. Ensures a schedule with the fixed id targeting `/outbox/_drain`, then
 *      reads it back → returns true (asserted present at boot).
 *   2. Uses upsert semantics (fixed scheduleId) so re-boot never duplicates.
 *   3. Missing QSTASH_TOKEN → skips cleanly, never calls QStash, returns false.
 *   4. QStash create failure is non-fatal → returns false, Sentry-captured.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type CreateReq = { scheduleId: string; destination: string; cron: string; retries?: number };
type ScheduleRow = { scheduleId: string; cron: string; destination: string };

const { mockCreate, mockGet, mockCaptureException, mockGetServerEnv } = vi.hoisted(() => ({
  mockCreate: vi.fn<(req: CreateReq) => Promise<{ scheduleId: string }>>(async () => ({
    scheduleId: 'outbox-drain',
  })),
  mockGet: vi.fn<(id: string) => Promise<ScheduleRow>>(async () => ({
    scheduleId: 'outbox-drain',
    cron: '* * * * *',
    destination: 'https://api.example.test/outbox/_drain',
  })),
  mockCaptureException: vi.fn(),
  mockGetServerEnv: vi.fn<() => { QSTASH_TOKEN?: string; API_URL: string }>(() => ({
    QSTASH_TOKEN: 'test-qstash-token',
    API_URL: 'https://api.example.test',
  })),
}));

vi.mock('@contractor-ops/integrations/services/qstash-client', () => ({
  getQStashClient: () => ({
    schedules: {
      create: (...a: unknown[]) => mockCreate(...(a as [CreateReq])),
      get: (...a: unknown[]) => mockGet(...(a as [string])),
    },
  }),
}));

vi.mock('@sentry/node', () => ({
  captureException: (...a: unknown[]) => mockCaptureException(...(a as [])),
}));

vi.mock('@contractor-ops/validators', async importOriginal => ({
  ...(await importOriginal<typeof import('@contractor-ops/validators')>()),
  getServerEnv: () => mockGetServerEnv(),
}));

import {
  ensureOutboxDrainSchedule,
  OUTBOX_DRAIN_SCHEDULE_ID,
} from '../lib/outbox-drain-schedule.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerEnv.mockReturnValue({
    QSTASH_TOKEN: 'test-qstash-token',
    API_URL: 'https://api.example.test',
  });
});

describe('ensureOutboxDrainSchedule', () => {
  it('upserts the drain schedule targeting /outbox/_drain and asserts it back', async () => {
    const ok = await ensureOutboxDrainSchedule();

    expect(ok).toBe(true);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const req = mockCreate.mock.calls[0]?.[0];
    if (!req) throw new Error('expected create to be called');
    // Fixed id → QStash upsert; re-boot updates in place, never duplicates.
    expect(req.scheduleId).toBe(OUTBOX_DRAIN_SCHEDULE_ID);
    expect(req.destination).toMatch(/\/outbox\/_drain$/);
    expect(req.cron).toBe('* * * * *');
    // Read-back assertion ran.
    expect(mockGet).toHaveBeenCalledWith(OUTBOX_DRAIN_SCHEDULE_ID);
  });

  it('skips cleanly and returns false when server env is unavailable (QSTASH_TOKEN unset)', async () => {
    // Required-field env validation throws when the token is absent; the
    // bootstrap treats that as a clean skip, never calling QStash.
    mockGetServerEnv.mockImplementationOnce(() => {
      throw new Error('QSTASH_TOKEN is required');
    });

    const ok = await ensureOutboxDrainSchedule();

    expect(ok).toBe(false);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('is non-fatal on QStash failure — returns false and reports to Sentry', async () => {
    mockCreate.mockRejectedValueOnce(new Error('qstash down'));

    const ok = await ensureOutboxDrainSchedule();

    expect(ok).toBe(false);
    expect(mockCaptureException).toHaveBeenCalledOnce();
  });

  it('fails the assertion when the schedule is missing after create', async () => {
    mockGet.mockResolvedValueOnce({ scheduleId: '', cron: '', destination: '' });

    const ok = await ensureOutboxDrainSchedule();

    expect(ok).toBe(false);
    expect(mockCaptureException).toHaveBeenCalledOnce();
  });
});
