/**
 * Unit tests for routes/invoices.ts (createRoute + cursor + filter/sort).
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockList, mockGetById, mockCreatePublicCaller } = vi.hoisted(() => {
  const mockList = vi.fn();
  const mockGetById = vi.fn();
  const mockCreatePublicCaller = vi.fn(() => ({
    invoice: { list: mockList, getById: mockGetById },
  }));
  return { mockList, mockGetById, mockCreatePublicCaller };
});

vi.mock('../../lib/create-caller.js', () => ({ createPublicCaller: mockCreatePublicCaller }));

import { handleError } from '../../lib/error-handler.js';
import { encodeCursor } from '../../lib/openapi-cursor.js';
import invoices from '../invoices.js';

const app = new Hono();
app.route('/', invoices);
app.onError(handleError);

describe('GET /invoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({ items: [], nextCursor: undefined });
  });

  it('parses filter[status] and filter[contractorId] into a nested filter', async () => {
    await app.request('/?filter[status]=APPROVED&filter[contractorId]=c-1');
    const [input] = mockList.mock.calls[0] as [{ filter?: Record<string, string> }];
    expect(input.filter).toMatchObject({ status: 'APPROVED', contractorId: 'c-1' });
  });

  it('decodes the opaque cursor and applies defaults', async () => {
    await app.request(`/?cursor=${encodeCursor('inv-9')}`);
    const [input] = mockList.mock.calls[0] as [{ cursor?: string; limit: number; sort: string }];
    expect(input).toMatchObject({ cursor: 'inv-9', limit: 25, sort: '-createdAt' });
  });

  it('rejects an unknown filter key with 400 (.strict())', async () => {
    const res = await app.request('/?filter[bogus]=x');
    expect(res.status).toBe(400);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('wraps the result in the { data, meta } cursor envelope', async () => {
    mockList.mockResolvedValueOnce({ items: [{ id: 'inv-1' }], nextCursor: 'inv-1' });
    const res = await app.request('/');
    const body = (await res.json()) as {
      data: unknown[];
      meta: { nextCursor: string; hasMore: boolean };
    };
    expect(body.data).toHaveLength(1);
    expect(body.meta.hasMore).toBe(true);
    expect(typeof body.meta.nextCursor).toBe('string');
  });
});

describe('GET /invoices/{id}', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forwards the id and wraps the result as { data }', async () => {
    const invoice = { id: 'inv-xyz' };
    mockGetById.mockResolvedValueOnce(invoice);
    const res = await app.request('/inv-xyz');
    expect(mockGetById).toHaveBeenCalledWith({ id: 'inv-xyz' });
    expect(await res.json()).toEqual({ data: invoice });
  });
});
