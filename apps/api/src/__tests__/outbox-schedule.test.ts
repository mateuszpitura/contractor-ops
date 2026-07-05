import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockCreate, mockList, mockGetQStashClient } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockList: vi.fn(),
  mockGetQStashClient: vi.fn(),
}));

vi.mock('@contractor-ops/integrations/services/qstash-client', () => ({
  getQStashClient: mockGetQStashClient,
}));

vi.mock('@contractor-ops/logger', () => {
  const stub = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
  };
  return { createLogger: vi.fn(() => stub) };
});

import { ensureOutboxDrainSchedule, OUTBOX_DRAIN_SCHEDULE_ID } from '../lib/outbox-schedule';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetQStashClient.mockReturnValue({
    schedules: { create: mockCreate, list: mockList },
  });
  mockCreate.mockResolvedValue({ scheduleId: OUTBOX_DRAIN_SCHEDULE_ID });
});

describe('ensureOutboxDrainSchedule', () => {
  it('upserts the drain schedule with a stable id and a per-minute cron', async () => {
    mockList.mockResolvedValue([{ scheduleId: OUTBOX_DRAIN_SCHEDULE_ID }]);

    const id = await ensureOutboxDrainSchedule({ apiUrl: 'https://api.example.com' });

    expect(id).toBe(OUTBOX_DRAIN_SCHEDULE_ID);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const arg = mockCreate.mock.calls[0]?.[0];
    expect(arg).toMatchObject({
      scheduleId: OUTBOX_DRAIN_SCHEDULE_ID,
      cron: '* * * * *',
      destination: 'https://api.example.com/outbox/_drain',
    });
  });

  it('strips a trailing slash from apiUrl when composing the destination', async () => {
    mockList.mockResolvedValue([{ scheduleId: OUTBOX_DRAIN_SCHEDULE_ID }]);

    await ensureOutboxDrainSchedule({ apiUrl: 'https://api.example.com/' });

    expect(mockCreate.mock.calls[0]?.[0]?.destination).toBe(
      'https://api.example.com/outbox/_drain',
    );
  });

  it('asserts the schedule exists after create — throws when the list omits it', async () => {
    mockList.mockResolvedValue([{ scheduleId: 'some-other-schedule' }]);

    await expect(ensureOutboxDrainSchedule({ apiUrl: 'https://api.example.com' })).rejects.toThrow(
      /not found after create/,
    );
  });
});
