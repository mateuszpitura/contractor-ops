// Phase 74 Plan 06 — OutlookCalendarAdapter.getFreeBusy GREEN tests.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OutlookCalendarAdapter } from '../outlook-calendar-adapter.js';

const ACCESS_TOKEN = 'super-secret-test-token-outlook-67890';

function mockFetch(handler: (url: string) => Promise<Response>) {
  return vi.spyOn(global, 'fetch').mockImplementation(async input => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    return handler(url);
  });
}

describe('OutlookCalendarAdapter.getFreeBusy — Plan 74-06', () => {
  let adapter: OutlookCalendarAdapter;

  beforeEach(() => {
    adapter = new OutlookCalendarAdapter();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls /me/calendar/getSchedule and parses busy/oof scheduleItems', async () => {
    mockFetch(async () => {
      return new Response(
        JSON.stringify({
          value: [
            {
              scheduleItems: [
                {
                  status: 'busy',
                  subject: 'Standup',
                  start: { dateTime: '2026-05-03T09:00:00Z' },
                  end: { dateTime: '2026-05-03T10:00:00Z' },
                  isAllDay: false,
                },
                {
                  status: 'oof',
                  subject: 'Vacation',
                  start: { dateTime: '2026-05-10T00:00:00Z' },
                  end: { dateTime: '2026-05-15T00:00:00Z' },
                  isAllDay: true,
                },
                {
                  status: 'free', // should be filtered out
                  subject: 'Lunch',
                  start: { dateTime: '2026-05-04T12:00:00Z' },
                  end: { dateTime: '2026-05-04T13:00:00Z' },
                },
                {
                  status: 'tentative', // should be filtered out
                  subject: 'Maybe meeting',
                  start: { dateTime: '2026-05-05T14:00:00Z' },
                  end: { dateTime: '2026-05-05T15:00:00Z' },
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const result = await adapter.getFreeBusy(ACCESS_TOKEN, {
      calendarId: 'manager@example.com',
      timeMin: '2026-05-01T00:00:00Z',
      timeMax: '2026-05-31T00:00:00Z',
    });
    expect(result.busy).toHaveLength(2);
    expect(result.busy[0]?.summary).toBe('Standup');
    expect(result.busy[0]?.isAllDay).toBe(false);
    expect(result.busy[1]?.summary).toBe('Vacation');
    expect(result.busy[1]?.isAllDay).toBe(true);
  });

  it('throws when Microsoft Graph returns >=400 and DOES NOT leak access token', async () => {
    mockFetch(async () => new Response('Insufficient privileges', { status: 403 }));
    let thrown: Error | undefined;
    try {
      await adapter.getFreeBusy(ACCESS_TOKEN, {
        timeMin: '2026-05-01T00:00:00Z',
        timeMax: '2026-05-02T00:00:00Z',
      });
    } catch (e) {
      thrown = e as Error;
    }
    expect(thrown).toBeDefined();
    expect(thrown!.message).toContain('Outlook getSchedule failed');
    expect(thrown!.message).toContain('403');
    expect(thrown!.message).not.toContain(ACCESS_TOKEN);
    expect(thrown!.message).not.toContain('Bearer');
  });

  it('returns empty array when no scheduleItems present', async () => {
    mockFetch(async () => {
      return new Response(JSON.stringify({ value: [{ scheduleItems: [] }] }), { status: 200 });
    });
    const result = await adapter.getFreeBusy(ACCESS_TOKEN, {
      timeMin: 'a',
      timeMax: 'b',
    });
    expect(result.busy).toEqual([]);
  });
});
