/**
 * Unit tests for routes/contracts.ts (createRoute + cursor + filter/sort).
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockList, mockGetById, mockCreatePublicCaller } = vi.hoisted(() => {
  const mockList = vi.fn();
  const mockGetById = vi.fn();
  const mockCreatePublicCaller = vi.fn(() => ({
    contract: { list: mockList, getById: mockGetById },
  }));
  return { mockList, mockGetById, mockCreatePublicCaller };
});

vi.mock('../../lib/create-caller.js', () => ({ createPublicCaller: mockCreatePublicCaller }));

import { handleError } from '../../lib/error-handler.js';
import { encodeCursor } from '../../lib/openapi-cursor.js';
import contracts from '../contracts.js';

const app = new Hono();
app.route('/', contracts);
app.onError(handleError);

describe('GET /contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({ items: [], nextCursor: undefined });
  });

  it('parses filter[status] and filter[contractorId] into a nested filter', async () => {
    await app.request('/?filter[status]=EXPIRED&filter[contractorId]=c-1');
    const [input] = mockList.mock.calls[0] as [{ filter?: Record<string, string> }];
    expect(input.filter).toMatchObject({ status: 'EXPIRED', contractorId: 'c-1' });
  });

  it('decodes the opaque cursor and applies defaults', async () => {
    await app.request(`/?cursor=${encodeCursor('ct-3')}`);
    const [input] = mockList.mock.calls[0] as [{ cursor?: string; limit: number; sort: string }];
    expect(input).toMatchObject({ cursor: 'ct-3', limit: 25, sort: '-createdAt' });
  });

  it('rejects an unknown filter key with 400 (.strict())', async () => {
    const res = await app.request('/?filter[bogus]=x');
    expect(res.status).toBe(400);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('wraps the last page as { data, meta: { nextCursor: null, hasMore: false } }', async () => {
    mockList.mockResolvedValueOnce({ items: [{ id: 'ct-1' }], nextCursor: undefined });
    const res = await app.request('/');
    const body = (await res.json()) as { meta: { nextCursor: null; hasMore: boolean } };
    expect(body.meta).toEqual({ nextCursor: null, hasMore: false });
  });
});

describe('GET /contracts/{id}', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forwards the id and wraps the result as { data }', async () => {
    const contract = { id: 'ct-xyz' };
    mockGetById.mockResolvedValueOnce(contract);
    const res = await app.request('/ct-xyz');
    expect(mockGetById).toHaveBeenCalledWith({ id: 'ct-xyz' });
    expect(await res.json()).toEqual({ data: contract });
  });
});
