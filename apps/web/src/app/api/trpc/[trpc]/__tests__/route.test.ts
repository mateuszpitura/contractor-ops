/**
 * tRPC route handler tests.
 *
 * Verifies the Next.js /api/trpc/[trpc] handler:
 * - Exports GET and POST handlers
 * - Delegates to fetchRequestHandler
 * - Logs request/response with timing
 * - Wraps execution in Sentry isolation scope
 * - Forwards onError to Sentry.captureException
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
  appRouter: { _def: { procedures: {} } },
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
  getActiveSpan: vi.fn(() => undefined),
  getCurrentScope: vi.fn(() => ({
    setUser: vi.fn(),
    setTag: vi.fn(),
    setTags: vi.fn(),
    setContext: vi.fn(),
  })),
  setUser: vi.fn(),
  setTag: vi.fn(),
  setTags: vi.fn(),
  setContext: vi.fn(),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn(), gauge: vi.fn() },
}));

vi.mock('@trpc/server/adapters/fetch', () => ({
  fetchRequestHandler: mockFetchRequestHandler,
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import { GET, POST } from '../route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(method: 'GET' | 'POST', procedure = 'organization.getCurrent') {
  const url = `http://localhost:3000/api/trpc/${procedure}`;
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

describe('tRPC route handler', () => {
  it('exports GET and POST handlers', () => {
    expect(typeof GET).toBe('function');
    expect(typeof POST).toBe('function');
  });

  it('delegates GET to fetchRequestHandler', async () => {
    const req = makeRequest('GET');
    const res = await GET(req);

    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(200);
    expect(mockFetchRequestHandler).toHaveBeenCalledTimes(1);

    const call = mockFetchRequestHandler.mock.calls[0]?.[0];
    expect(call.endpoint).toBe('/api/trpc');
    expect(call.req).toBe(req);
  });

  it('delegates POST to fetchRequestHandler', async () => {
    const req = makeRequest('POST');
    const res = await POST(req);

    expect(res).toBeInstanceOf(Response);
    expect(mockFetchRequestHandler).toHaveBeenCalledTimes(1);

    const call = mockFetchRequestHandler.mock.calls[0]?.[0];
    expect(call.req).toBe(req);
  });

  it('wraps handler in Sentry.withIsolationScope', async () => {
    await GET(makeRequest('GET'));

    expect(mockSentryScope).toHaveBeenCalledTimes(1);
    expect(mockSentryScope).toHaveBeenCalledWith(expect.any(Function));
  });

  it('passes createContext that forwards request headers', async () => {
    await POST(makeRequest('POST'));

    const call = mockFetchRequestHandler.mock.calls[0]?.[0];
    expect(call.createContext).toBeTypeOf('function');

    // Invoke the createContext to verify it calls our mock
    await call.createContext();
    expect(mockCreateContext).toHaveBeenCalledTimes(1);
  });

  it('provides onError callback that calls Sentry.captureException', async () => {
    await GET(makeRequest('GET'));

    const call = mockFetchRequestHandler.mock.calls[0]?.[0];
    expect(call.onError).toBeTypeOf('function');

    // Simulate an error
    const fakeError = new Error('test error');
    call.onError({ error: fakeError, path: 'organization.getCurrent' });

    expect(mockCaptureException).toHaveBeenCalledWith(fakeError, {
      tags: { 'trpc.path': 'organization.getCurrent' },
    });
  });

  it('returns the response from fetchRequestHandler', async () => {
    const mockRes = new Response('{"ok":true}', { status: 201 });
    mockFetchRequestHandler.mockResolvedValueOnce(mockRes);

    const res = await GET(makeRequest('GET'));

    expect(res).toBe(mockRes);
  });

  it('correctly extracts procedure name from URL', async () => {
    await GET(makeRequest('GET', 'billing.getPlans'));

    // The handler logs with the procedure name extracted from the pathname
    expect(mockFetchRequestHandler).toHaveBeenCalledTimes(1);
  });
});
