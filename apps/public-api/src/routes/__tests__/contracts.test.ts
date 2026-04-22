/**
 * Unit tests for routes/contracts.ts
 *
 * Covers: GET / query param coercion + forwarding, GET /:id forwarding.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

// ---------------------------------------------------------------------------
// Caller stub — must use vi.hoisted() because vi.mock() is hoisted above
// top-level const declarations.
// ---------------------------------------------------------------------------

const { mockList, mockGetById, mockCreatePublicCaller } = vi.hoisted(() => {
  const mockList = vi.fn();
  const mockGetById = vi.fn();
  const mockCreatePublicCaller = vi.fn(() => ({
    contract: { list: mockList, getById: mockGetById },
  }));
  return { mockList, mockGetById, mockCreatePublicCaller };
});

vi.mock('../../lib/create-caller.js', () => ({
  createPublicCaller: mockCreatePublicCaller,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import contracts from '../contracts.js';

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = new Hono();
app.route('/', contracts);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeListResult(overrides = {}) {
  return { items: [], total: 0, page: 1, pageSize: 25, ...overrides };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue(makeListResult());
  });

  it('forwards page and pageSize as numbers', async () => {
    await app.request('/?page=3&pageSize=50');
    const [input] = mockList.mock.calls[0] as [{ page: unknown; pageSize: unknown }][];
    expect(input).toMatchObject({ page: 3, pageSize: 50 });
  });

  it('forwards status query param', async () => {
    await app.request('/?status=ACTIVE');
    const [input] = mockList.mock.calls[0] as [{ status: unknown }][];
    expect(input).toMatchObject({ status: 'ACTIVE' });
  });

  it('forwards contractorId query param', async () => {
    await app.request('/?contractorId=con_42');
    const [input] = mockList.mock.calls[0] as [{ contractorId: unknown }][];
    expect(input).toMatchObject({ contractorId: 'con_42' });
  });

  it('forwards sortBy and sortOrder query params', async () => {
    await app.request('/?sortBy=startDate&sortOrder=asc');
    const [input] = mockList.mock.calls[0] as [{ sortBy: unknown; sortOrder: unknown }][];
    expect(input).toMatchObject({ sortBy: 'startDate', sortOrder: 'asc' });
  });

  it('forwards all params together correctly', async () => {
    await app.request('/?page=1&pageSize=5&status=DRAFT&contractorId=c1&sortBy=title&sortOrder=asc');
    const [input] = mockList.mock.calls[0] as [Record<string, unknown>][];
    expect(input).toMatchObject({
      page: 1,
      pageSize: 5,
      status: 'DRAFT',
      contractorId: 'c1',
      sortBy: 'title',
      sortOrder: 'asc',
    });
  });

  it('passes undefined for all params when none provided', async () => {
    await app.request('/');
    const [input] = mockList.mock.calls[0] as [Record<string, unknown>][];
    expect(input.page).toBeUndefined();
    expect(input.pageSize).toBeUndefined();
    expect(input.status).toBeUndefined();
    expect(input.contractorId).toBeUndefined();
    expect(input.sortBy).toBeUndefined();
    expect(input.sortOrder).toBeUndefined();
  });

  it('returns 200 and wraps result in { data, meta }', async () => {
    const items = [{ id: 'cnt-1', title: 'Contract A' }];
    mockList.mockResolvedValueOnce({ items, total: 1, page: 1, pageSize: 25 });
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; meta: unknown };
    expect(body.data).toEqual(items);
    expect(body.meta).toMatchObject({ total: 1, page: 1, pageSize: 25 });
  });
});

describe('GET /contracts/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls caller.contract.getById with the route param id', async () => {
    mockGetById.mockResolvedValueOnce({ id: 'cnt-abc' });
    await app.request('/cnt-abc');
    expect(mockGetById).toHaveBeenCalledWith({ id: 'cnt-abc' });
  });

  it('wraps the result as { data }', async () => {
    const contract = { id: 'cnt-xyz', title: 'Dev Contract' };
    mockGetById.mockResolvedValueOnce(contract);
    const res = await app.request('/cnt-xyz');
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown };
    expect(body).toEqual({ data: contract });
  });
});
