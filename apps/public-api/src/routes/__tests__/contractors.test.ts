/**
 * Unit tests for routes/contractors.ts (createRoute + cursor + filter/sort).
 * Covers bracket-filter parsing, cursor decode/encode, the {data,meta} envelope,
 * strict validation, and getById forwarding.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockList, mockGetById, mockCreatePublicCaller } = vi.hoisted(() => {
  const mockList = vi.fn();
  const mockGetById = vi.fn();
  const mockCreatePublicCaller = vi.fn(() => ({
    contractor: { list: mockList, getById: mockGetById },
  }));
  return { mockList, mockGetById, mockCreatePublicCaller };
});

vi.mock('../../lib/create-caller.js', () => ({ createPublicCaller: mockCreatePublicCaller }));

import { handleError } from '../../lib/error-handler.js';
import { encodeCursor } from '../../lib/openapi-cursor.js';
import contractors from '../contractors.js';

const app = new Hono();
app.route('/', contractors);
app.onError(handleError);

describe('GET /contractors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({ items: [], nextCursor: undefined });
  });

  it('parses filter[status] into a nested filter object', async () => {
    await app.request('/?filter[status]=ACTIVE');
    const [input] = mockList.mock.calls[0] as [{ filter?: { status?: string } }];
    expect(input.filter).toMatchObject({ status: 'ACTIVE' });
  });

  it('forwards limit and sort; applies defaults', async () => {
    await app.request('/?limit=15&sort=legalName');
    const [input] = mockList.mock.calls[0] as [{ limit: number; sort: string }];
    expect(input).toMatchObject({ limit: 15, sort: 'legalName' });

    mockList.mockClear();
    await app.request('/');
    const [dflt] = mockList.mock.calls[0] as [{ limit: number; sort: string }];
    expect(dflt).toMatchObject({ limit: 25, sort: '-createdAt' });
  });

  it('decodes the opaque cursor before calling the caller', async () => {
    await app.request(`/?cursor=${encodeCursor('ctr-42')}`);
    const [input] = mockList.mock.calls[0] as [{ cursor?: string }];
    expect(input.cursor).toBe('ctr-42');
  });

  it('returns 400 for an invalid enum and never calls the caller', async () => {
    const res = await app.request('/?filter[status]=NOT_A_STATUS');
    expect(res.status).toBe(400);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('returns 400 for an unknown filter key (.strict())', async () => {
    const res = await app.request('/?filter[bogus]=x');
    expect(res.status).toBe(400);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('wraps the last page as { data, meta: { nextCursor: null, hasMore: false } }', async () => {
    const items = [{ id: 'ctr-1', legalName: 'Acme Ltd' }];
    mockList.mockResolvedValueOnce({ items, nextCursor: undefined });
    const res = await app.request('/');
    const body = (await res.json()) as {
      data: unknown[];
      meta: { nextCursor: null; hasMore: boolean };
    };
    expect(body.data).toEqual(items);
    expect(body.meta).toEqual({ nextCursor: null, hasMore: false });
  });

  it('encodes nextCursor and sets hasMore when there is another page', async () => {
    mockList.mockResolvedValueOnce({ items: [{ id: 'ctr-1' }], nextCursor: 'ctr-1' });
    const res = await app.request('/');
    const body = (await res.json()) as { meta: { nextCursor: string; hasMore: boolean } };
    expect(body.meta.hasMore).toBe(true);
    expect(typeof body.meta.nextCursor).toBe('string');
  });
});

describe('GET /contractors/{id}', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forwards the id and wraps the result as { data }', async () => {
    const contractor = { id: 'ctr-xyz', legalName: 'Acme Ltd' };
    mockGetById.mockResolvedValueOnce(contractor);
    const res = await app.request('/ctr-xyz');
    expect(res.status).toBe(200);
    expect(mockGetById).toHaveBeenCalledWith({ id: 'ctr-xyz' });
    expect(await res.json()).toEqual({ data: contractor });
  });
});
