/**
 * Unit tests for create-caller.ts
 *
 * Covers: Authorization header forwarding, missing Authorization fallback.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockCreateApiKeyContext, mockCallerFactory, mockCaller } = vi.hoisted(() => {
  const mockCaller = { invoice: { list: vi.fn() } };
  const mockCallerFactory = vi.fn(() => mockCaller);
  const mockCreateApiKeyContext = vi.fn((opts: { headers: Headers }) => ({
    headers: opts.headers,
  }));
  return { mockCreateApiKeyContext, mockCallerFactory, mockCaller };
});

vi.mock('@contractor-ops/api', () => ({
  createApiKeyContext: mockCreateApiKeyContext,
  createCallerFactory: vi.fn(() => mockCallerFactory),
  publicApiRouter: {},
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createPublicCaller } from '../create-caller.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHonoContext(authHeader?: string): import('hono').Context {
  return {
    req: {
      header: vi.fn((name: string) => {
        if (name === 'authorization') return authHeader;
        return;
      }),
    },
  } as unknown as import('hono').Context;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createPublicCaller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes the Authorization header value to createApiKeyContext', () => {
    const token = 'Bearer co_live_abc123';
    const c = makeHonoContext(token);
    createPublicCaller(c);

    expect(mockCreateApiKeyContext).toHaveBeenCalledOnce();
    const [arg] = mockCreateApiKeyContext.mock.calls[0] as [{ headers: Headers }];
    expect(arg.headers).toBeInstanceOf(Headers);
    expect(arg.headers.get('authorization')).toBe(token);
  });

  it('passes an empty string when Authorization header is missing', () => {
    const c = makeHonoContext(undefined);
    createPublicCaller(c);

    expect(mockCreateApiKeyContext).toHaveBeenCalledOnce();
    const [arg] = mockCreateApiKeyContext.mock.calls[0] as [{ headers: Headers }];
    expect(arg.headers.get('authorization')).toBe('');
  });

  it('returns the caller produced by the factory', () => {
    const c = makeHonoContext('Bearer co_live_xyz');
    const result = createPublicCaller(c);
    expect(result).toBe(mockCaller);
  });

  it('calls createApiKeyContext with a Headers instance (not a plain object)', () => {
    const c = makeHonoContext('Bearer co_live_test');
    createPublicCaller(c);
    const [arg] = mockCreateApiKeyContext.mock.calls[0] as [{ headers: unknown }];
    expect(arg.headers).toBeInstanceOf(Headers);
  });
});
