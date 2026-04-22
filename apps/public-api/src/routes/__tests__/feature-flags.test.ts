/**
 * Unit tests for routes/feature-flags.ts
 *
 * Covers: GET / calls caller.featureFlags.list() and wraps result as { data }.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

// ---------------------------------------------------------------------------
// Caller stub — must use vi.hoisted() because vi.mock() is hoisted above
// top-level const declarations.
// ---------------------------------------------------------------------------

const { mockList, mockCreatePublicCaller } = vi.hoisted(() => {
  const mockList = vi.fn();
  const mockCreatePublicCaller = vi.fn(() => ({
    featureFlags: { list: mockList },
  }));
  return { mockList, mockCreatePublicCaller };
});

vi.mock('../../lib/create-caller.js', () => ({
  createPublicCaller: mockCreatePublicCaller,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import featureFlags from '../feature-flags.js';

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = new Hono();
app.route('/', featureFlags);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /feature-flags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls caller.featureFlags.list()', async () => {
    mockList.mockResolvedValueOnce([]);
    await app.request('/');
    expect(mockList).toHaveBeenCalledOnce();
  });

  it('wraps the result as { data: flags }', async () => {
    const flags = [{ key: 'feature-a', enabled: true }, { key: 'feature-b', enabled: false }];
    mockList.mockResolvedValueOnce(flags);
    const res = await app.request('/');
    const body = await res.json() as { data: unknown };
    expect(body).toEqual({ data: flags });
  });

  it('returns 200 status', async () => {
    mockList.mockResolvedValueOnce([]);
    const res = await app.request('/');
    expect(res.status).toBe(200);
  });

  it('constructs the caller with the incoming Hono context', async () => {
    mockList.mockResolvedValueOnce([]);
    await app.request('/');
    expect(mockCreatePublicCaller).toHaveBeenCalledOnce();
    // The context passed should be the Hono Context object (has req/res/etc)
    const [ctx] = mockCreatePublicCaller.mock.calls[0] as [{ req: unknown }];
    expect(ctx).toBeDefined();
    expect(ctx.req).toBeDefined();
  });

  it('returns empty data array when no flags exist', async () => {
    mockList.mockResolvedValueOnce([]);
    const res = await app.request('/');
    const body = await res.json() as { data: unknown[] };
    expect(body.data).toEqual([]);
  });
});
