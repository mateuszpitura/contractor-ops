/**
 * Calendar idempotency: deterministic event ids make re-issuing an event a
 * no-op upsert (no duplicate insert on transport retry).
 *
 * The existing adapter suites cover createEvent's happy/error paths but never
 * assert the deterministic dedup key derived from `idempotencyKey`:
 *   - Google encodes it into the event `id` (RFC 2938 base32hex sha-256),
 *   - Outlook encodes it into the `client-request-id` Graph header.
 *
 * Same key → identical wire id (Google rejects the duplicate insert; Outlook
 * correlates it). Different key → different id. No key → a fresh random id each
 * call (so an un-keyed retry is NOT silently deduped — the documented trade-off).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleCalendarAdapter } from '../google-calendar-adapter.js';
import { OutlookCalendarAdapter } from '../outlook-calendar-adapter.js';

function mockFetch(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  });
}

const event = {
  summary: 'Stand-up',
  subject: 'Stand-up',
  startDateTime: '2026-04-04T09:00:00.000Z',
  endDateTime: '2026-04-04T09:30:00.000Z',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Google Calendar — deterministic event id from idempotency key', () => {
  async function capturedBodyId(idempotencyKey?: string): Promise<unknown> {
    const fetchMock = mockFetch({ id: 'evt', htmlLink: 'https://x', etag: 'e' });
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new GoogleCalendarAdapter();
    await adapter.createEvent('tok', event, idempotencyKey);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    return JSON.parse(init.body as string).id;
  }

  it('same idempotency key yields the same event id (no-op upsert)', async () => {
    const a = await capturedBodyId('org:google-calendar.event.create:deadline-42');
    const b = await capturedBodyId('org:google-calendar.event.create:deadline-42');
    expect(a).toBeTypeOf('string');
    expect(a).toBe(b);
  });

  it('different idempotency key yields a different event id', async () => {
    const a = await capturedBodyId('org:google-calendar.event.create:deadline-42');
    const b = await capturedBodyId('org:google-calendar.event.create:deadline-99');
    expect(a).not.toBe(b);
  });

  it('encodes the id in Google base32hex (chars 0-9 a-v only)', async () => {
    const id = (await capturedBodyId('org:google-calendar.event.create:deadline-42')) as string;
    expect(id).toMatch(/^[0-9a-v]+$/);
    expect(id.length).toBeGreaterThanOrEqual(5);
  });

  it('omits the id when no idempotency key is supplied (no dedup, no random collision)', async () => {
    const id = await capturedBodyId();
    expect(id).toBeUndefined();
  });
});

describe('Outlook Calendar — deterministic client-request-id from idempotency key', () => {
  async function capturedClientRequestId(idempotencyKey?: string): Promise<string> {
    const fetchMock = mockFetch({ id: 'evt', webLink: 'https://x' });
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new OutlookCalendarAdapter();
    await adapter.createEvent('tok', event, idempotencyKey);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    return (init.headers as Record<string, string>)['client-request-id'];
  }

  it('same idempotency key yields the same client-request-id', async () => {
    const a = await capturedClientRequestId('org:outlook-calendar.event.create:deadline-42');
    const b = await capturedClientRequestId('org:outlook-calendar.event.create:deadline-42');
    expect(a).toBeTypeOf('string');
    expect(a).toBe(b);
  });

  it('different idempotency key yields a different client-request-id', async () => {
    const a = await capturedClientRequestId('org:outlook-calendar.event.create:deadline-42');
    const b = await capturedClientRequestId('org:outlook-calendar.event.create:deadline-99');
    expect(a).not.toBe(b);
  });

  it('derives a UUID-shaped value', async () => {
    const id = await capturedClientRequestId('org:outlook-calendar.event.create:deadline-42');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('uses a fresh random id per call when no idempotency key is supplied', async () => {
    const a = await capturedClientRequestId();
    const b = await capturedClientRequestId();
    expect(a).not.toBe(b);
  });
});
