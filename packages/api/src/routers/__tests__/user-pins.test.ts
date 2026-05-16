/**
 * Unit tests for the `user.pins` sub-router.
 *
 * Strategy: mock `@contractor-ops/db` so the router operates against an
 * in-memory representation of `UserPinnedView`. Build a tRPC caller bound
 * to just the `userPinsRouter` so we don't have to mock the rest of the
 * app's heavy service surface.
 */

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => {
  type Pin = { id: string; userId: string; kind: string; key: string; pinnedAt: Date };
  let nextId = 1;
  let rows: Pin[] = [];

  const mockPrisma = {
    userPinnedView: {
      findMany: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        const where = (args.where ?? {}) as { userId?: string; kind?: string };
        return rows
          .filter(r => (where.userId ? r.userId === where.userId : true))
          .filter(r => (where.kind ? r.kind === where.kind : true))
          .sort((a, b) => a.pinnedAt.getTime() - b.pinnedAt.getTime())
          .map(r => ({ kind: r.kind, key: r.key, pinnedAt: r.pinnedAt }));
      }),
      findUnique: vi.fn(async (args: { where: Record<string, unknown> }) => {
        const composite = args.where.userId_kind_key as
          | { userId: string; kind: string; key: string }
          | undefined;
        if (!composite) return null;
        const hit = rows.find(
          r =>
            r.userId === composite.userId && r.kind === composite.kind && r.key === composite.key,
        );
        return hit ? { id: hit.id } : null;
      }),
      create: vi.fn(async (args: { data: Omit<Pin, 'id' | 'pinnedAt'> }) => {
        const pin: Pin = {
          id: `pin_${nextId++}`,
          userId: args.data.userId,
          kind: args.data.kind,
          key: args.data.key,
          pinnedAt: new Date(Date.now() + nextId),
        };
        rows.push(pin);
        return pin;
      }),
      delete: vi.fn(async (args: { where: { id: string } }) => {
        const before = rows.length;
        rows = rows.filter(r => r.id !== args.where.id);
        return before === rows.length ? null : { id: args.where.id };
      }),
    },
    __reset() {
      rows = [];
      nextId = 1;
    },
    __rows() {
      return rows;
    },
    __seed(pin: Pin) {
      rows.push(pin);
    },
  };

  return { mockPrisma };
});

vi.mock('@contractor-ops/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@contractor-ops/logger', () => ({
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  withBodyLogging: vi.fn((_o: unknown, fn: () => unknown) => fn),
  logIntegrationCall: vi.fn(),
  subscribeOpossumEvents: vi.fn(),
  runWithRequestContext: vi.fn((_c: unknown, fn: () => unknown) => fn()),
  getRequestId: vi.fn(() => undefined),
  getTraceparent: vi.fn(() => undefined),
  buildContextFromHeaders: vi.fn(() => ({})),
  getOutboundHeaders: vi.fn(() => ({})),
  generateRequestId: vi.fn(() => 'test-request-id'),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  LOG_BODY_INCLUDE_PREFIXES: [],
  PII_MASK_KEYWORDS: [],
  PII_MASK_PATHS: [],
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory, router } from '../../init';
import { userPinsRouter } from '../core/user-pins';

// Wrap the sub-router so we test it in isolation — avoids depending on the
// full app router's transitive mock surface.
const isolatedRouter = router({ pins: userPinsRouter });
const createCaller = createCallerFactory(isolatedRouter);

function makeCaller(userId: string | null) {
  const user = userId
    ? {
        id: userId,
        name: 'Test',
        email: `${userId}@example.com`,
        emailVerified: true,
        image: null,
        banned: false,
        banReason: null,
        banExpires: null,
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    : null;
  const session = userId
    ? {
        session: {
          id: `session-${userId}`,
          userId,
          activeOrganizationId: null,
          expiresAt: new Date('2099-01-01'),
          token: 'mock-token',
          createdAt: new Date(),
          updatedAt: new Date(),
          ipAddress: null,
          userAgent: null,
        },
        user,
      }
    : null;
  return createCaller({
    headers: new Headers(),
    session: session as never,
    user: user as never,
  });
}

const USER_A = 'usr_aaa';
const USER_B = 'usr_bbb';

beforeEach(() => {
  mockPrisma.__reset();
  vi.clearAllMocks();
});

describe('user.pins.list', () => {
  it("returns only the caller's pins", async () => {
    mockPrisma.__seed({
      id: 'p1',
      userId: USER_A,
      kind: 'settings-tab',
      key: 'integrations',
      pinnedAt: new Date('2026-01-01'),
    });
    mockPrisma.__seed({
      id: 'p2',
      userId: USER_B,
      kind: 'settings-tab',
      key: 'billing',
      pinnedAt: new Date('2026-01-01'),
    });

    const caller = makeCaller(USER_A);
    const out = await caller.pins.list({ kind: 'settings-tab' });

    expect(out).toEqual([expect.objectContaining({ kind: 'settings-tab', key: 'integrations' })]);
  });

  it('orders results by pinnedAt ascending (insertion order)', async () => {
    mockPrisma.__seed({
      id: 'p1',
      userId: USER_A,
      kind: 'settings-tab',
      key: 'integrations',
      pinnedAt: new Date('2026-01-02'),
    });
    mockPrisma.__seed({
      id: 'p2',
      userId: USER_A,
      kind: 'settings-tab',
      key: 'billing',
      pinnedAt: new Date('2026-01-01'),
    });

    const caller = makeCaller(USER_A);
    const out = await caller.pins.list({ kind: 'settings-tab' });

    expect(out.map(p => p.key)).toEqual(['billing', 'integrations']);
  });

  it('rejects unauthenticated callers with UNAUTHORIZED', async () => {
    const caller = makeCaller(null);
    await expect(caller.pins.list({ kind: 'settings-tab' })).rejects.toBeInstanceOf(TRPCError);
    await expect(caller.pins.list({ kind: 'settings-tab' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

describe('user.pins.toggle', () => {
  it('creates the pin when not yet present', async () => {
    const caller = makeCaller(USER_A);
    const result = await caller.pins.toggle({ kind: 'settings-tab', key: 'billing' });
    expect(result).toEqual({ pinned: true });
    expect(mockPrisma.__rows()).toHaveLength(1);
    expect(mockPrisma.__rows()[0]).toMatchObject({ userId: USER_A, key: 'billing' });
  });

  it('removes the pin when already present (idempotent toggle)', async () => {
    mockPrisma.__seed({
      id: 'p1',
      userId: USER_A,
      kind: 'settings-tab',
      key: 'integrations',
      pinnedAt: new Date('2026-01-01'),
    });

    const caller = makeCaller(USER_A);
    const result = await caller.pins.toggle({ kind: 'settings-tab', key: 'integrations' });
    expect(result).toEqual({ pinned: false });
    expect(mockPrisma.__rows()).toHaveLength(0);
  });

  it('rejects unauthenticated callers with UNAUTHORIZED', async () => {
    const caller = makeCaller(null);
    await expect(
      caller.pins.toggle({ kind: 'settings-tab', key: 'general' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects invalid kind via Zod', async () => {
    const caller = makeCaller(USER_A);
    // @ts-expect-error — kind is a string-literal union; we want Zod to catch it
    await expect(caller.pins.toggle({ kind: 'unknown', key: 'foo' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
});
