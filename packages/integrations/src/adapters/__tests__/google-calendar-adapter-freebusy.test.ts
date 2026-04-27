// Phase 74 Plan 06 — GoogleCalendarAdapter.getFreeBusy GREEN tests.
//
// Uses fetch-mock pattern via vi.spyOn(global, 'fetch') — no msw needed for
// this small surface. Verifies merge of /freeBusy + events.list responses
// and that error paths never leak the access token.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleCalendarAdapter } from '../google-calendar-adapter.js';

const ACCESS_TOKEN = 'super-secret-test-token-google-12345';

function mockFetch(handler: (url: string, init?: RequestInit) => Promise<Response>) {
  return vi.spyOn(global, 'fetch').mockImplementation(async input => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    return handler(url);
  });
}

describe('GoogleCalendarAdapter.getFreeBusy — Plan 74-06', () => {
  let adapter: GoogleCalendarAdapter;

  beforeEach(() => {
    adapter = new GoogleCalendarAdapter();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POSTs to /freeBusy and merges events.list for titles + isAllDay', async () => {
    mockFetch(async url => {
      if (url.includes('/freeBusy')) {
        return new Response(
          JSON.stringify({
            calendars: {
              primary: {
                busy: [
                  { start: '2026-05-01T00:00:00Z', end: '2026-05-02T00:00:00Z' },
                  { start: '2026-05-03T09:00:00Z', end: '2026-05-03T10:00:00Z' },
                ],
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('/calendars/primary/events')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                summary: 'On vacation',
                start: { date: '2026-05-01' },
                end: { date: '2026-05-02' },
                attendees: [],
              },
              {
                summary: 'Standup',
                start: { dateTime: '2026-05-03T09:00:00Z' },
                end: { dateTime: '2026-05-03T10:00:00Z' },
                attendees: [{ email: 'a@b' }, { email: 'c@d' }],
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('not found', { status: 404 });
    });

    const result = await adapter.getFreeBusy(ACCESS_TOKEN, {
      timeMin: '2026-05-01T00:00:00Z',
      timeMax: '2026-05-04T00:00:00Z',
    });
    expect(result.busy).toHaveLength(2);
    expect(result.busy[0]?.summary).toBe('On vacation');
    expect(result.busy[0]?.isAllDay).toBe(true);
    expect(result.busy[1]?.summary).toBe('Standup');
    expect(result.busy[1]?.isAllDay).toBe(false);
    expect(result.busy[1]?.attendeeCount).toBe(2);
  });

  it('throws with non-2xx response body in error message and DOES NOT leak access token', async () => {
    mockFetch(async () => new Response('forbidden — invalid scope', { status: 403 }));
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
    expect(thrown!.message).toContain('Google Calendar freebusy failed');
    expect(thrown!.message).toContain('403');
    expect(thrown!.message).not.toContain(ACCESS_TOKEN);
    expect(thrown!.message).not.toContain('Bearer');
  });

  it('returns ranges without titles when events.list enrichment fails (non-fatal)', async () => {
    mockFetch(async url => {
      if (url.includes('/freeBusy')) {
        return new Response(
          JSON.stringify({
            calendars: { primary: { busy: [{ start: 'a', end: 'b' }] } },
          }),
          { status: 200 },
        );
      }
      // events.list fails
      return new Response('quota exceeded', { status: 429 });
    });
    const result = await adapter.getFreeBusy(ACCESS_TOKEN, {
      timeMin: 'a',
      timeMax: 'b',
    });
    expect(result.busy).toHaveLength(1);
    expect(result.busy[0]?.summary).toBeUndefined();
  });
});
