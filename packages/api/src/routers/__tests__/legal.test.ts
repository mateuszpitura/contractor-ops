/**
 * Pins for the `legalRouter.generatePrivacyNoticePdf` IDOR-by-construction
 * contract.
 *
 * The mutation's `paramsSchema` is `z.object({}).optional()` so a caller
 * CANNOT supply a `jurisdiction` field — Zod strips extra properties by
 * default. The exporter resolves jurisdiction from
 * `organization.countryCode` (`packages/api/src/services/privacy-notice.ts:269-274`)
 * and only renders for whitelisted GB/DE/EU; AE/SA flow through the PDPL
 * consent router. A tampered payload that tries to ask for a foreign
 * jurisdiction is invisible to every downstream consumer — the safety
 * is structural, not a runtime check.
 *
 * These tests pin the structural guarantee so a future refactor that
 * loosens the input schema (e.g. accepts `jurisdiction` for "convenience")
 * fails here with an obvious message.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_A = 'clxxxxxxxxxxxxxxxxxxxxxxxa';
const USER_A = 'clyyyyyyyyyyyyyyyyyyyyyyya';
const EXPORT_ID = 'clexportaaaaaaaaaaaaaaaaaa';

// ---------------------------------------------------------------------------
// Hoisted mocks — same shape as invoice-intake.test.ts so the tenant
// middleware (loadAndAssertActive → getOrgMeta → Prisma) does not hit a
// real database during the unit test.
// ---------------------------------------------------------------------------

const { mockPrisma, mockRequestExport } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;
  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn(async () => ({ dataRegion: 'EU', status: 'ACTIVE' })),
    },
    member: { findFirst: vi.fn(async () => ({ role: 'member' })) },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };
  return {
    mockPrisma,
    mockRequestExport: vi.fn(),
  };
});

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      hasPermission: vi.fn().mockResolvedValue({ success: true }),
    },
  },
  authApi: {
    hasPermission: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: mockPrisma,
  tenantStore: {
    run: (_ctx: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(() => ({ region: 'EU' })),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
  getRegionalClient: vi.fn(() => mockPrisma),
}));

vi.mock('../../services/org-cache', () => ({
  getOrgMeta: vi.fn(async (orgId: string) => ({
    id: orgId,
    dataRegion: 'EU',
    status: 'ACTIVE',
    name: 'Test Org',
  })),
  invalidateOrgMeta: vi.fn(async () => undefined),
  ORG_META_TTL_SECONDS: 300,
  orgMetaKey: (orgId: string) => `org:${orgId}:meta`,
}));

vi.mock('../../services/exports/index', () => ({
  requestExport: mockRequestExport,
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { createCallerFactory } from '../../init';
import { legalRouter } from '../core/legal';

const createCaller = createCallerFactory(legalRouter);

function makeCaller(userId = USER_A, orgId = ORG_A) {
  const session = {
    session: {
      id: `session-${userId}`,
      userId,
      activeOrganizationId: orgId,
      expiresAt: new Date('2099-01-01'),
      token: 'mock-token',
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: userId,
      name: 'Test User',
      email: `${userId}@example.com`,
      emailVerified: true,
      image: null,
      banned: false,
      banReason: null,
      banExpires: null,
      role: 'member',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
  return createCaller({
    headers: new Headers(),
    session: session as never,
    user: session.user as never,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequestExport.mockResolvedValue({ exportId: EXPORT_ID, status: 'PENDING' });
});

describe('legalRouter.generatePrivacyNoticePdf — IDOR-by-construction', () => {
  it('1. empty body enqueues an export with the session orgId and empty params', async () => {
    const caller = makeCaller();
    const result = await caller.generatePrivacyNoticePdf();
    expect(result).toEqual({ exportId: EXPORT_ID, status: 'PENDING' });
    expect(mockRequestExport).toHaveBeenCalledTimes(1);
    expect(mockRequestExport).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_A,
        requestedByUserId: USER_A,
        type: 'gdpr-privacy-notice',
        params: {},
      }),
    );
  });

  it('2. a tampered `jurisdiction` field is stripped before reaching the exporter', async () => {
    const caller = makeCaller();
    // Zod's default object behaviour drops anything not declared in the
    // schema. Cast to `any` so the test exercises the runtime stripping
    // rather than relying on TypeScript narrowing.
    // biome-ignore lint/suspicious/noExplicitAny: explicit tamper attempt
    await (caller.generatePrivacyNoticePdf as any)({ jurisdiction: 'SA' });
    const args = mockRequestExport.mock.calls[0]?.[0] as
      | { params?: Record<string, unknown> }
      | undefined;
    expect(args).toBeDefined();
    expect(args?.params).toEqual({});
    expect(JSON.stringify(args?.params)).not.toContain('jurisdiction');
    expect(JSON.stringify(args?.params)).not.toContain('SA');
  });

  it('3. exporter type is fixed at `gdpr-privacy-notice` regardless of caller input', async () => {
    const caller = makeCaller();
    // biome-ignore lint/suspicious/noExplicitAny: explicit tamper attempt
    await (caller.generatePrivacyNoticePdf as any)({
      jurisdiction: 'AE',
      type: 'drv-defense-bundle',
    });
    expect(mockRequestExport).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'gdpr-privacy-notice' }),
    );
  });

  it('4. organizationId always derives from the session — never from caller body', async () => {
    const caller = makeCaller();
    // biome-ignore lint/suspicious/noExplicitAny: explicit tamper attempt
    await (caller.generatePrivacyNoticePdf as any)({
      organizationId: 'clOTHERORGattacker0000000000',
    });
    expect(mockRequestExport).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG_A }),
    );
  });
});
