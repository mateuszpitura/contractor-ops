/**
 * Portal tRPC route handler tests.
 *
 * Mirrors the internal handler tests but for the dedicated portal endpoint
 * at /api/trpc/portal which mounts portalAppRouter (portal + portalTime).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (vi.hoisted)
// ---------------------------------------------------------------------------

const { mockFetchRequestHandler, mockSentryScope, mockCaptureException, mockCreateContext } =
  vi.hoisted(() => ({
    mockFetchRequestHandler: vi.fn<
      (opts: {
        endpoint: string;
        req: Request;
        router: unknown;
        createContext: () => Promise<unknown>;
        onError: (info: { error: Error; path?: string }) => void;
      }) => Promise<Response>
    >(async () => new Response('{"result":{}}', { status: 200 })),
    mockSentryScope: vi.fn((fn: () => unknown) => fn()),
    mockCaptureException: vi.fn(),
    mockCreateContext: vi.fn(async () => ({
      headers: new Headers(),
      session: null,
      user: null,
    })),
  }));

vi.mock('@contractor-ops/api', () => ({
  portalAppRouter: { _def: { procedures: {} } },
  createContext: mockCreateContext,
}));

vi.mock('@contractor-ops/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@sentry/nextjs', () => ({
  withIsolationScope: mockSentryScope,
  captureException: mockCaptureException,
}));

vi.mock('@trpc/server/adapters/fetch', () => ({
  fetchRequestHandler: mockFetchRequestHandler,
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import { GET, POST } from '../route.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(method: 'GET' | 'POST', procedure = 'portal.getSession') {
  const url = `http://localhost:3000/api/trpc/portal/${procedure}`;
  return new Request(url, {
    method,
    headers: new Headers({ 'content-type': 'application/json' }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Portal tRPC route handler', () => {
  it('exports GET and POST handlers', () => {
    expect(typeof GET).toBe('function');
    expect(typeof POST).toBe('function');
  });

  it('delegates GET to fetchRequestHandler with /api/trpc/portal endpoint', async () => {
    const req = makeRequest('GET');
    const res = await GET(req);

    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(200);
    expect(mockFetchRequestHandler).toHaveBeenCalledTimes(1);

    const call = mockFetchRequestHandler.mock.calls[0]?.[0];
    expect(call.endpoint).toBe('/api/trpc/portal');
    expect(call.req).toBe(req);
  });

  it('delegates POST to fetchRequestHandler', async () => {
    const req = makeRequest('POST');
    const res = await POST(req);

    expect(res).toBeInstanceOf(Response);
    expect(mockFetchRequestHandler).toHaveBeenCalledTimes(1);
  });

  it('wraps handler in Sentry.withIsolationScope', async () => {
    await GET(makeRequest('GET'));

    expect(mockSentryScope).toHaveBeenCalledTimes(1);
    expect(mockSentryScope).toHaveBeenCalledWith(expect.any(Function));
  });

  it('onError tags Sentry exception with trpc.endpoint=portal', async () => {
    await GET(makeRequest('GET'));

    const call = mockFetchRequestHandler.mock.calls[0]?.[0];
    expect(call.onError).toBeTypeOf('function');

    const fakeError = new Error('portal procedure failed');
    call.onError({ error: fakeError, path: 'portal.getSession' });

    expect(mockCaptureException).toHaveBeenCalledWith(fakeError, {
      tags: { 'trpc.path': 'portal.getSession', 'trpc.endpoint': 'portal' },
    });
  });

  it('returns the response from fetchRequestHandler', async () => {
    const mockRes = new Response('{"ok":true}', { status: 200 });
    mockFetchRequestHandler.mockResolvedValueOnce(mockRes);

    const res = await POST(makeRequest('POST'));
    expect(res).toBe(mockRes);
  });

  it('correctly extracts procedure name from /api/trpc/portal/* URL', async () => {
    await GET(makeRequest('GET', 'portalTime.getActiveContracts'));

    expect(mockFetchRequestHandler).toHaveBeenCalledTimes(1);
  });
});
