/**
 * Unit tests for routes/contractors.ts
 *
 * Covers: GET / query param coercion + forwarding, GET /:id forwarding.
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
    contractor: { list: mockList, getById: mockGetById },
  }));
  return { mockList, mockGetById, mockCreatePublicCaller };
});

vi.mock('../../lib/create-caller.js', () => ({
  createPublicCaller: mockCreatePublicCaller,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { handleError } from '../../lib/error-handler.js';
import contractors from '../contractors.js';

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = new Hono();
app.route('/', contractors);
app.onError(handleError);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeListResult(overrides = {}) {
  return { items: [], total: 0, page: 1, pageSize: 25, ...overrides };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /contractors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue(makeListResult());
  });

  it('forwards page and pageSize as numbers', async () => {
    await app.request('/?page=2&pageSize=15');
    const [input] = mockList.mock.calls[0] as [{ page: unknown; pageSize: unknown }][];
    expect(input).toMatchObject({ page: 2, pageSize: 15 });
  });

  it('forwards status query param', async () => {
    await app.request('/?status=ACTIVE');
    const [input] = mockList.mock.calls[0] as [{ status: unknown }][];
    expect(input).toMatchObject({ status: 'ACTIVE' });
  });

  it('forwards lifecycleStage query param', async () => {
    await app.request('/?lifecycleStage=ONBOARDING');
    const [input] = mockList.mock.calls[0] as [{ lifecycleStage: unknown }][];
    expect(input).toMatchObject({ lifecycleStage: 'ONBOARDING' });
  });

  it('forwards sortBy and sortOrder query params', async () => {
    await app.request('/?sortBy=legalName&sortOrder=asc');
    const [input] = mockList.mock.calls[0] as [{ sortBy: unknown; sortOrder: unknown }][];
    expect(input).toMatchObject({ sortBy: 'legalName', sortOrder: 'asc' });
  });

  it('forwards all params together correctly', async () => {
    await app.request(
      '/?page=1&pageSize=10&status=INACTIVE&lifecycleStage=ENDED&sortBy=createdAt&sortOrder=desc',
    );
    const [input] = mockList.mock.calls[0] as [Record<string, unknown>];
    expect(input).toMatchObject({
      page: 1,
      pageSize: 10,
      status: 'INACTIVE',
      lifecycleStage: 'ENDED',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  });

  it('applies schema defaults and omits optional filters when none provided', async () => {
    await app.request('/');
    const [input] = mockList.mock.calls[0] as [Record<string, unknown>];
    expect(input).toMatchObject({
      page: 1,
      pageSize: 25,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    expect(input.status).toBeUndefined();
    expect(input.lifecycleStage).toBeUndefined();
  });

  it('returns 400 and never calls the caller for an invalid enum value', async () => {
    const res = await app.request('/?status=NOT_A_STATUS');
    expect(res.status).toBe(400);
    expect(mockList).not.toHaveBeenCalled();
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 200 and wraps result in { data, meta }', async () => {
    const items = [{ id: 'ctr-1', legalName: 'Acme Ltd' }];
    mockList.mockResolvedValueOnce({ items, total: 1, page: 1, pageSize: 25 });
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[]; meta: unknown };
    expect(body.data).toEqual(items);
    expect(body.meta).toMatchObject({ total: 1, page: 1, pageSize: 25 });
  });
});

describe('GET /contractors/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls caller.contractor.getById with the route param id', async () => {
    mockGetById.mockResolvedValueOnce({ id: 'ctr-abc' });
    await app.request('/ctr-abc');
    expect(mockGetById).toHaveBeenCalledWith({ id: 'ctr-abc' });
  });

  it('wraps the result as { data }', async () => {
    const contractor = { id: 'ctr-xyz', legalName: 'Acme Ltd' };
    mockGetById.mockResolvedValueOnce(contractor);
    const res = await app.request('/ctr-xyz');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown };
    expect(body).toEqual({ data: contractor });
  });
});
