import { createMockServer, selectHandlers } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { GoogleCalendarAdapter } from '../google-calendar-adapter.js';

const { server } = createMockServer({
  handlersOnly: true,
  extraHandlers: selectHandlers(['googleCalendar']),
});

beforeAll(() => {
  process.env.GOOGLE_CALENDAR_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'test-client-secret';
  server.listen({ onUnhandledRequest: 'warn' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('GoogleCalendarAdapter MSW integration', () => {
  const adapter = new GoogleCalendarAdapter();

  it('exchangeCodeForTokens() returns tokens', async () => {
    const result = await adapter.exchangeCodeForTokens('test-code', 'http://localhost/callback');

    expect(result.accessToken).toMatch(/^google_mock_/);
    expect(result.refreshToken).toMatch(/^google_refresh_/);
    expect(result.tokenType).toBe('Bearer');
    expect(result.scope).toBe('https://www.googleapis.com/auth/calendar.events');
    expect(result.expiresAt).toBeDefined();
  });

  it('createEvent() returns eventId and htmlLink', async () => {
    const result = await adapter.createEvent('mock-access-token', {
      summary: 'Test Meeting',
      startDateTime: '2026-04-15T10:00:00Z',
      endDateTime: '2026-04-15T11:00:00Z',
    });

    expect(result.eventId).toBeDefined();
    expect(result.htmlLink).toContain('google.com/calendar/event');
    expect(result.etag).toBeDefined();
  });

  it('updateEvent() returns updated eventId', async () => {
    const result = await adapter.updateEvent(
      'mock-access-token',
      'evt-123',
      { summary: 'Updated Meeting' },
      '"etag-value"',
    );

    expect(result.eventId).toBe('evt-123');
    expect(result.htmlLink).toContain('evt-123');
    expect(result.etag).toBeDefined();
  });

  it('deleteEvent() succeeds without throwing', async () => {
    await expect(
      adapter.deleteEvent('mock-access-token', 'evt-to-delete'),
    ).resolves.toBeUndefined();
  });
});
