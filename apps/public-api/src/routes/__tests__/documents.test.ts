/**
 * Unit tests for routes/documents.ts (createRoute + cursor + filter/sort).
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockList, mockGetDownloadUrl, mockCreatePublicCaller } = vi.hoisted(() => {
  const mockList = vi.fn();
  const mockGetDownloadUrl = vi.fn();
  const mockCreatePublicCaller = vi.fn(() => ({
    document: { list: mockList, getDownloadUrl: mockGetDownloadUrl },
  }));
  return { mockList, mockGetDownloadUrl, mockCreatePublicCaller };
});

vi.mock('../../lib/create-caller.js', () => ({ createPublicCaller: mockCreatePublicCaller }));

import { handleError } from '../../lib/error-handler.js';
import { encodeCursor } from '../../lib/openapi-cursor.js';
import documents from '../documents.js';

const app = new Hono();
app.route('/', documents);
app.onError(handleError);

describe('GET /documents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({ items: [], nextCursor: undefined });
  });

  it('parses filter[entityType] and filter[entityId] into a nested filter', async () => {
    await app.request('/?filter[entityType]=INVOICE&filter[entityId]=e-1');
    const [input] = mockList.mock.calls[0] as [{ filter?: Record<string, string> }];
    expect(input.filter).toMatchObject({ entityType: 'INVOICE', entityId: 'e-1' });
  });

  it('decodes the opaque cursor and applies defaults', async () => {
    await app.request(`/?cursor=${encodeCursor('doc-2')}`);
    const [input] = mockList.mock.calls[0] as [{ cursor?: string; limit: number; sort: string }];
    expect(input).toMatchObject({ cursor: 'doc-2', limit: 25, sort: '-createdAt' });
  });

  it('rejects an unknown filter key with 400 (.strict())', async () => {
    const res = await app.request('/?filter[bogus]=x');
    expect(res.status).toBe(400);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('wraps the result in the { data, meta } cursor envelope', async () => {
    mockList.mockResolvedValueOnce({ items: [{ id: 'doc-1' }], nextCursor: undefined });
    const res = await app.request('/');
    const body = (await res.json()) as {
      data: unknown[];
      meta: { nextCursor: null; hasMore: boolean };
    };
    expect(body.data).toHaveLength(1);
    expect(body.meta).toEqual({ nextCursor: null, hasMore: false });
  });
});

describe('GET /documents/{id}/download-url', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forwards the id and wraps the presigned url as { data }', async () => {
    const dl = { url: 'https://signed.example/doc', expiresIn: 900 };
    mockGetDownloadUrl.mockResolvedValueOnce(dl);
    const res = await app.request('/doc-xyz/download-url');
    expect(mockGetDownloadUrl).toHaveBeenCalledWith({ id: 'doc-xyz' });
    expect(await res.json()).toEqual({ data: dl });
  });
});
