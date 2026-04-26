/**
 * Phase 61 · Plan 61-06 Task 2 — einvoice.finalize router-level tests.
 *
 * Strategy:
 *   - Mock `@contractor-ops/db`, `@contractor-ops/auth`, `@contractor-ops/einvoice`,
 *     the finalize service module, and the r2 service.
 *   - Create a tRPC caller via `createCallerFactory` + `makeCaller`.
 *   - Verify the router delegates to `finalizeEInvoice` and maps domain
 *     errors to the correct tRPC codes.
 *
 * Coverage:
 *   1. Happy path — returns FinalizeResult.
 *   2. No `invoice:update` permission → FORBIDDEN.
 *   3. Service throws EInvoiceInvoiceNotFoundError → NOT_FOUND.
 *   4. Service throws EInvoiceAlreadyFinalizedError (force=false, existing) → CONFLICT.
 *   5. Cross-tenant invoiceId → NOT_FOUND (resolved by the service).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';
const USER_ID = 'clyyyyyyyyyyyyyyyyyyyyyyyy';
const INVOICE_ID = 'clinvoice000000000000000001';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockPrisma, mockFinalizeEInvoice } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn(async () => ({
        dataRegion: 'EU',
        name: 'Test Org',
      })),
    },
    eInvoiceLifecycle: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    eInvoiceLifecycleEvent: {
      create: vi.fn(),
    },
    invoice: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(async () => 0),
    },
    integrationConnection: { findFirst: vi.fn() },
    integrationSyncLog: { findMany: vi.fn(async () => []) },
    peppolParticipant: { findFirst: vi.fn() },
    member: { findFirst: vi.fn(async () => ({ role: 'admin' })) },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return {
    mockPrisma,
    mockFinalizeEInvoice: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Mock modules — must import from the service for the real error classes.
// ---------------------------------------------------------------------------

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

vi.mock('@contractor-ops/einvoice', async importOriginal => {
  const actual = await importOriginal<typeof import('@contractor-ops/einvoice')>();
  return {
    ...actual,
    // Replace the XRechnungDEProfile class with a stub so the router's
    // `new XRechnungDEProfile()` doesn't exercise the real KoSIT bundle.
    XRechnungDEProfile: class {
      async generateAndValidate() {
        return {
          xml: '<xml/>',
          report: { status: 'VALID', ruleSetVersion: 'XRechnung 3.0.2', layers: [] },
        };
      }
      async validateRich() {
        return { status: 'VALID', ruleSetVersion: 'XRechnung 3.0.2', layers: [] };
      }
    },
  };
});

vi.mock('../../services/einvoice-finalize.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../../services/einvoice-finalize.js')>();
  return {
    ...actual,
    finalizeEInvoice: mockFinalizeEInvoice,
  };
});

vi.mock('../../services/peppol-adapter-factory.js', () => ({
  buildStorecoveAdapterForOrg: vi.fn(async () => null),
}));

vi.mock('../../services/r2.js', () => ({
  putObjectString: vi.fn(async () => undefined),
  getObjectAsString: vi.fn(async () => '<xml/>'),
  signExistingDownload: vi.fn(async () => ({
    signedUrl: 'https://r2.example.com/download',
    expiresInSeconds: 300,
  })),
}));

vi.mock('../../services/cache.js', () => ({
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: {
    orgSettings: (orgId: string) => `org-settings:${orgId}`,
    orgSettingsJson: (orgId: string, key: string) => `org-settings-json:${orgId}:${key}`,
    orgBranding: (orgId: string) => `org-branding:${orgId}`,
    settingsPrefix: (orgId: string) => `org-settings:${orgId}`,
    approvalChains: (orgId: string) => `approval-chains:${orgId}`,
  },
  CacheTTL: { ORG_SETTINGS: 300, ORG_SETTINGS_JSON: 300, ORG_BRANDING: 300, APPROVAL_CHAINS: 300 },
}));

vi.mock('@sentry/nextjs', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('@contractor-ops/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { auth, authApi } from '@contractor-ops/auth';
import { TRPCError } from '@trpc/server';

import { createCallerFactory } from '../../init.js';
import { appRouter } from '../../root.js';
import {
  EInvoiceAlreadyFinalizedError,
  EInvoiceInvoiceNotFoundError,
} from '../../services/einvoice-finalize.js';

const createCaller = createCallerFactory(appRouter);

function makeCaller(userId = USER_ID, orgId = ORG_ID) {
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
      role: 'admin',
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

const caller = makeCaller();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth.api.hasPermission).mockResolvedValue({ success: true } as never);
  vi.mocked(authApi.hasPermission).mockResolvedValue({ success: true } as never);
});

describe('einvoice.finalize', () => {
  it('happy path — returns FinalizeResult from finalizeEInvoice service', async () => {
    const fakeResult = {
      lifecycleId: 'lc-1',
      validationStatus: 'VALID' as const,
      validationReport: {
        status: 'VALID' as const,
        ruleSetVersion: 'XRechnung 3.0.2',
        layers: [],
      },
      xmlSha256: 'a'.repeat(64),
      xmlDownloadUrl: 'https://r2.test/abc',
      xmlDownloadExpiresInSeconds: 300,
      warnings: [],
      resolvedLeitwegId: null,
    };
    mockFinalizeEInvoice.mockResolvedValueOnce(fakeResult);

    const result = await caller.einvoice.finalize({
      invoiceId: INVOICE_ID,
      force: false,
    });

    expect(result).toEqual(fakeResult);
    expect(mockFinalizeEInvoice).toHaveBeenCalledOnce();
    const [, serviceInput] = mockFinalizeEInvoice.mock.calls[0] ?? [];
    expect((serviceInput as { organizationId: string }).organizationId).toBe(ORG_ID);
    expect((serviceInput as { invoiceId: string }).invoiceId).toBe(INVOICE_ID);
    expect((serviceInput as { actorUserId: string | null }).actorUserId).toBe(USER_ID);
  });

  it('FORBIDDEN when caller lacks invoice:update permission', async () => {
    vi.mocked(authApi.hasPermission).mockResolvedValueOnce({ success: false } as never);
    vi.mocked(auth.api.hasPermission).mockResolvedValueOnce({ success: false } as never);

    await expect(
      caller.einvoice.finalize({ invoiceId: INVOICE_ID, force: false }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(mockFinalizeEInvoice).not.toHaveBeenCalled();
  });

  it('NOT_FOUND when the service throws EInvoiceInvoiceNotFoundError (missing / cross-tenant invoice)', async () => {
    mockFinalizeEInvoice.mockRejectedValueOnce(new EInvoiceInvoiceNotFoundError(INVOICE_ID));

    const promise = caller.einvoice.finalize({
      invoiceId: INVOICE_ID,
      force: false,
    });

    await expect(promise).rejects.toBeInstanceOf(TRPCError);
    await expect(promise).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'EINVOICE_INVOICE_NOT_FOUND',
    });
  });

  it('CONFLICT when finalize service raises EInvoiceAlreadyFinalizedError (force=false + existing row)', async () => {
    mockFinalizeEInvoice.mockRejectedValueOnce(new EInvoiceAlreadyFinalizedError(INVOICE_ID));

    const promise = caller.einvoice.finalize({
      invoiceId: INVOICE_ID,
      force: false,
    });

    await expect(promise).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'EINVOICE_ALREADY_FINALIZED',
    });
  });

  it('propagates unknown errors (not translated to NOT_FOUND / CONFLICT)', async () => {
    mockFinalizeEInvoice.mockRejectedValueOnce(new Error('boom'));

    await expect(caller.einvoice.finalize({ invoiceId: INVOICE_ID, force: false })).rejects.toThrow(
      'boom',
    );
  });
});
