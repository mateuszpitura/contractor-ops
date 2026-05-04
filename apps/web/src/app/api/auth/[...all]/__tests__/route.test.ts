/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// F-OBS-09 — the route no longer re-exports `toNextJsHandler(auth)` directly.
// It now wraps both GET and POST with an ALS-aware observability layer that
// seeds request context, logs the request lifecycle, and forwards 5xx
// responses to Sentry. These tests assert the wrapper still delegates to the
// underlying Better Auth handler AND drives the right side-effects.

const { mockGet, mockPost, mockCaptureMessage, mockCaptureException, mockRunWithRequestContext } =
  vi.hoisted(() => ({
    mockGet: vi.fn(),
    mockPost: vi.fn(),
    mockCaptureMessage: vi.fn(),
    mockCaptureException: vi.fn(),
    mockRunWithRequestContext: vi.fn(
      <T,>(_ctx: unknown, fn: () => Promise<T> | T): Promise<T> | T => fn(),
    ),
  }));

vi.mock('@contractor-ops/auth', () => ({
  auth: {},
}));

vi.mock('better-auth/next-js', () => ({
  toNextJsHandler: vi.fn(() => ({
    GET: mockGet,
    POST: mockPost,
  })),
}));

vi.mock('@contractor-ops/logger', () => ({
  // The wrapper builds a trace context from incoming headers and seeds an ALS
  // frame via `runWithRequestContext`. The test stand-ins are pass-throughs so
  // the inner Better Auth handler still runs.
  buildContextFromHeaders: vi.fn(() => ({ requestId: 'test-req' })),
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  runWithRequestContext: mockRunWithRequestContext,
}));

vi.mock('@sentry/nextjs', () => ({
  captureMessage: mockCaptureMessage,
  captureException: mockCaptureException,
}));

describe('/api/auth/[...all] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish the ALS pass-through after clearAllMocks wipes the impl.
    mockRunWithRequestContext.mockImplementation(
      <T,>(_ctx: unknown, fn: () => Promise<T> | T): Promise<T> | T => fn(),
    );
  });

  it('exports GET and POST handlers wrapping the Better Auth handler', async () => {
    const { GET, POST } = await import('../route');
    const { toNextJsHandler } = await import('better-auth/next-js');

    expect(typeof GET).toBe('function');
    expect(typeof POST).toBe('function');
    expect(vi.mocked(toNextJsHandler)).toHaveBeenCalled();
  });

  it('delegates GET to the underlying Better Auth handler and returns its response', async () => {
    const { GET } = await import('../route');
    const innerResponse = new Response(null, { status: 200 });
    mockGet.mockResolvedValueOnce(innerResponse);

    const request = new Request('https://app.example.com/api/auth/session');
    const response = await GET(request);

    expect(response).toBe(innerResponse);
    expect(mockGet).toHaveBeenCalledWith(request);
    expect(mockRunWithRequestContext).toHaveBeenCalledTimes(1);
  });

  it('delegates POST to the underlying Better Auth handler and returns its response', async () => {
    const { POST } = await import('../route');
    const innerResponse = new Response(null, { status: 201 });
    mockPost.mockResolvedValueOnce(innerResponse);

    const request = new Request('https://app.example.com/api/auth/sign-in', {
      method: 'POST',
    });
    const response = await POST(request);

    expect(response).toBe(innerResponse);
    expect(mockPost).toHaveBeenCalledWith(request);
  });

  it('forwards 5xx responses to Sentry via captureMessage', async () => {
    const { GET } = await import('../route');
    mockGet.mockResolvedValueOnce(new Response(null, { status: 500 }));

    const request = new Request('https://app.example.com/api/auth/session');
    const response = await GET(request);

    expect(response.status).toBe(500);
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      expect.stringContaining('500'),
      expect.objectContaining({ level: 'error' }),
    );
  });

  it('captures thrown errors and re-throws them', async () => {
    const { POST } = await import('../route');
    const boom = new Error('handler exploded');
    mockPost.mockRejectedValueOnce(boom);

    const request = new Request('https://app.example.com/api/auth/sign-in', {
      method: 'POST',
    });
    await expect(POST(request)).rejects.toBe(boom);
    expect(mockCaptureException).toHaveBeenCalledWith(boom, expect.any(Object));
  });
});
