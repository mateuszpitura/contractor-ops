/**
 * Unit tests for routes/documents.ts
 *
 * Covers: GET / query param coercion + forwarding, GET /:id/download-url.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

// ---------------------------------------------------------------------------
// Caller stub — must use vi.hoisted() because vi.mock() is hoisted above
// top-level const declarations.
// ---------------------------------------------------------------------------

const { mockList, mockGetDownloadUrl, mockCreatePublicCaller } = vi.hoisted(() => {
  const mockList = vi.fn();
  const mockGetDownloadUrl = vi.fn();
  const mockCreatePublicCaller = vi.fn(() => ({
    document: { list: mockList, getDownloadUrl: mockGetDownloadUrl },
  }));
  return { mockList, mockGetDownloadUrl, mockCreatePublicCaller };
});

vi.mock('../../lib/create-caller.js', () => ({
  createPublicCaller: mockCreatePublicCaller,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import documents from '../documents.js';

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = new Hono();
app.route('/', documents);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeListResult(overrides = {}) {
  return { items: [], total: 0, page: 1, pageSize: 25, ...overrides };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /documents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue(makeListResult());
  });

  it('forwards page and pageSize as numbers', async () => {
    await app.request('/?page=2&pageSize=20');
    const [input] = mockList.mock.calls[0] as [{ page: unknown; pageSize: unknown }][];
    expect(input).toMatchObject({ page: 2, pageSize: 20 });
  });

  it('forwards entityType query param', async () => {
    await app.request('/?entityType=CONTRACTOR');
    const [input] = mockList.mock.calls[0] as [{ entityType: unknown }][];
    expect(input).toMatchObject({ entityType: 'CONTRACTOR' });
  });

  it('forwards entityId query param', async () => {
    await app.request('/?entityId=ent-abc');
    const [input] = mockList.mock.calls[0] as [{ entityId: unknown }][];
    expect(input).toMatchObject({ entityId: 'ent-abc' });
  });

  it('forwards sortOrder query param', async () => {
    await app.request('/?sortOrder=asc');
    const [input] = mockList.mock.calls[0] as [{ sortOrder: unknown }][];
    expect(input).toMatchObject({ sortOrder: 'asc' });
  });

  it('forwards all params together correctly', async () => {
    await app.request('/?page=1&pageSize=10&entityType=CONTRACT&entityId=cnt-1&sortOrder=desc');
    const [input] = mockList.mock.calls[0] as [Record<string, unknown>][];
    expect(input).toMatchObject({
      page: 1,
      pageSize: 10,
      entityType: 'CONTRACT',
      entityId: 'cnt-1',
      sortOrder: 'desc',
    });
  });

  it('passes undefined for all params when none provided', async () => {
    await app.request('/');
    const [input] = mockList.mock.calls[0] as [Record<string, unknown>][];
    expect(input.page).toBeUndefined();
    expect(input.pageSize).toBeUndefined();
    expect(input.entityType).toBeUndefined();
    expect(input.entityId).toBeUndefined();
    expect(input.sortOrder).toBeUndefined();
  });

  it('returns 200 and wraps result in { data, meta }', async () => {
    const items = [{ id: 'doc-1', name: 'Contract.pdf' }];
    mockList.mockResolvedValueOnce({ items, total: 1, page: 1, pageSize: 25 });
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; meta: unknown };
    expect(body.data).toEqual(items);
    expect(body.meta).toMatchObject({ total: 1, page: 1, pageSize: 25 });
  });
});

describe('GET /documents/:id/download-url', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls caller.document.getDownloadUrl with the route param id', async () => {
    mockGetDownloadUrl.mockResolvedValueOnce({ url: 'https://example.com/signed', expiresAt: '2099-01-01' });
    await app.request('/doc-abc/download-url');
    expect(mockGetDownloadUrl).toHaveBeenCalledWith({ id: 'doc-abc' });
  });

  it('wraps the result as { data }', async () => {
    const result = { url: 'https://r2.example.com/signed?token=xyz', expiresAt: '2099-12-31' };
    mockGetDownloadUrl.mockResolvedValueOnce(result);
    const res = await app.request('/doc-xyz/download-url');
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown };
    expect(body).toEqual({ data: result });
  });

  it('passes the exact document id from the URL to the caller', async () => {
    const docId = 'doc-unique-123';
    mockGetDownloadUrl.mockResolvedValueOnce({ url: 'https://r2.example.com/file', expiresAt: '2099' });
    await app.request(`/${docId}/download-url`);
    expect(mockGetDownloadUrl).toHaveBeenCalledWith({ id: docId });
  });
});
