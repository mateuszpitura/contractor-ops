/**
 * Unit tests for routes/invoices.ts
 *
 * Covers: GET / query param coercion, GET /:id forwarding.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Caller stub — must use vi.hoisted() because vi.mock() is hoisted above
// top-level const declarations.
// ---------------------------------------------------------------------------

const { mockList, mockGetById, mockCreatePublicCaller } = vi.hoisted(() => {
  const mockList = vi.fn();
  const mockGetById = vi.fn();
  const mockCreatePublicCaller = vi.fn(() => ({
    invoice: { list: mockList, getById: mockGetById },
  }));
  return { mockList, mockGetById, mockCreatePublicCaller };
});

vi.mock('../../lib/create-caller.js', () => ({
  createPublicCaller: mockCreatePublicCaller,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import invoices from '../invoices.js';

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = new Hono();
app.route('/', invoices);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeListResult(overrides = {}) {
  return {
    items: [],
    total: 0,
    page: 1,
    pageSize: 25,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /invoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue(makeListResult());
  });

  it('forwards page and pageSize as numbers', async () => {
    await app.request('/?page=2&pageSize=10');
    const [input] = mockList.mock.calls[0] as [{ page: unknown; pageSize: unknown }][];
    expect(input).toMatchObject({ page: 2, pageSize: 10 });
  });

  it('forwards status query param as-is', async () => {
    await app.request('/?status=PAID');
    const [input] = mockList.mock.calls[0] as [{ status: unknown }][];
    expect(input).toMatchObject({ status: 'PAID' });
  });

  it('forwards contractorId query param', async () => {
    await app.request('/?contractorId=c_1');
    const [input] = mockList.mock.calls[0] as [{ contractorId: unknown }][];
    expect(input).toMatchObject({ contractorId: 'c_1' });
  });

  it('forwards sortBy and sortOrder query params', async () => {
    await app.request('/?sortBy=dueDate&sortOrder=desc');
    const [input] = mockList.mock.calls[0] as [{ sortBy: unknown; sortOrder: unknown }][];
    expect(input).toMatchObject({ sortBy: 'dueDate', sortOrder: 'desc' });
  });

  it('passes all params together correctly', async () => {
    await app.request(
      '/?page=2&pageSize=10&status=PAID&contractorId=c_1&sortBy=dueDate&sortOrder=desc',
    );
    const [input] = mockList.mock.calls[0] as [Record<string, unknown>][];
    expect(input).toMatchObject({
      page: 2,
      pageSize: 10,
      status: 'PAID',
      contractorId: 'c_1',
      sortBy: 'dueDate',
      sortOrder: 'desc',
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
    const items = [{ id: 'inv-1' }];
    mockList.mockResolvedValueOnce({ items, total: 1, page: 1, pageSize: 25 });
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[]; meta: unknown };
    expect(body.data).toEqual(items);
    expect(body.meta).toMatchObject({ total: 1, page: 1, pageSize: 25 });
  });

  it('passes an invalid status value through as-is (no transformation)', async () => {
    await app.request('/?status=INVALID_STATUS');
    const [input] = mockList.mock.calls[0] as [{ status: unknown }][];
    expect(input.status).toBe('INVALID_STATUS');
  });
});

describe('GET /invoices/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls caller.invoice.getById with the route param id', async () => {
    mockGetById.mockResolvedValueOnce({ id: 'inv-abc' });
    await app.request('/inv-abc');
    expect(mockGetById).toHaveBeenCalledWith({ id: 'inv-abc' });
  });

  it('wraps the result as { data }', async () => {
    const invoice = { id: 'inv-xyz', status: 'PAID' };
    mockGetById.mockResolvedValueOnce(invoice);
    const res = await app.request('/inv-xyz');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown };
    expect(body).toEqual({ data: invoice });
  });
});
