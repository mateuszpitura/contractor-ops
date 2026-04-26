import { createMockServer, selectHandlers } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { OutlookCalendarAdapter } from '../outlook-calendar-adapter.js';

const { server } = createMockServer({
  handlersOnly: true,
  extraHandlers: selectHandlers(['outlookCalendar']),
});

beforeAll(() => {
  process.env.OUTLOOK_CLIENT_ID = 'test-client-id';
  process.env.OUTLOOK_CLIENT_SECRET = 'test-client-secret';
  server.listen({ onUnhandledRequest: 'warn' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('OutlookCalendarAdapter MSW integration', () => {
  const adapter = new OutlookCalendarAdapter();

  it('exchangeCodeForTokens() returns tokens', async () => {
    const result = await adapter.exchangeCodeForTokens('test-code', 'http://localhost/callback');

    expect(result.accessToken).toMatch(/^outlook_mock_/);
    expect(result.refreshToken).toMatch(/^outlook_refresh_/);
    expect(result.tokenType).toBe('Bearer');
    expect(result.scope).toBe('Calendars.ReadWrite');
    expect(result.expiresAt).toBeDefined();
  });

  it('createEvent() returns eventId and webLink', async () => {
    const result = await adapter.createEvent('mock-access-token', {
      subject: 'Test Meeting',
      startDateTime: '2026-04-15T10:00:00Z',
      endDateTime: '2026-04-15T11:00:00Z',
    });

    expect(result.eventId).toBeDefined();
    expect(result.webLink).toContain('outlook.office365.com');
  });

  it('updateEvent() returns updated eventId', async () => {
    const result = await adapter.updateEvent('mock-access-token', 'evt-123', {
      subject: 'Updated Meeting',
    });

    expect(result.eventId).toBe('evt-123');
    expect(result.webLink).toContain('evt-123');
  });

  it('deleteEvent() succeeds without throwing', async () => {
    await expect(
      adapter.deleteEvent('mock-access-token', 'evt-to-delete'),
    ).resolves.toBeUndefined();
  });
});
