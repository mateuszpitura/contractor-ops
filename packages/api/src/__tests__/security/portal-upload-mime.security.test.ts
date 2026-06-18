/**
 * Portal upload MIME admission (input validation, Tier 4 / upload security).
 *
 * `portal.getUploadUrl` mints a presigned PUT for contractor invoice uploads and
 * Zod-refines `contentType` to `application/pdf` only. The existing
 * `invoice-submit-upload.test.ts` covers `formatFileSize` UI but never the
 * server-side MIME gate. This asserts a non-PDF content type is rejected at the
 * validation boundary (BAD_REQUEST) before any presigned URL is minted, and a
 * PDF passes through to minting.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'org-portal-upload-001';
const CONTRACTOR_ID = 'contractor-portal-upload-001';
const TOKEN = 'portal-session-upload-token';

const { mockPrisma, createPendingUploadMock } = vi.hoisted(() => ({
  mockPrisma: {
    organization: {
      findUnique: vi.fn(async () => ({ id: 'org', dataRegion: 'EU', status: 'ACTIVE' })),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
  },
  createPendingUploadMock: vi.fn(async () => ({
    documentId: 'doc-1',
    presignedPutUrl: 'https://r2.example.com/put',
    expiresAt: new Date('2099-01-01'),
  })),
}));

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: { getSession: vi.fn(), hasPermission: vi.fn().mockResolvedValue({ success: true }) },
  },
  authApi: { hasPermission: vi.fn().mockResolvedValue({ success: true }) },
}));

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: mockPrisma,
  prismaRaw: mockPrisma,
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

vi.mock('@contractor-ops/feature-flags', () => ({
  evaluate: vi.fn(() => ({ enabled: true, reason: 'unleash' })),
  buildFlagBag: vi.fn(() => ({ isEnabled: () => true })),
}));

vi.mock('../../services/pending-upload', () => ({
  createPendingUpload: createPendingUploadMock,
  consumePendingUpload: vi.fn(),
}));

vi.mock('../../services/portal-session', () => ({
  validatePortalSession: vi.fn(async (token: string) =>
    token === TOKEN
      ? {
          contractorId: CONTRACTOR_ID,
          organizationId: ORG_ID,
          email: 'c@test.com',
          contractor: { id: CONTRACTOR_ID, email: 'c@test.com' },
        }
      : null,
  ),
  createPortalSession: vi.fn(),
  deletePortalSession: vi.fn(),
}));

vi.mock('@contractor-ops/logger', () => ({
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  withBodyLogging: vi.fn((_o, fn) => fn),
  logIntegrationCall: vi.fn(),
  subscribeOpossumEvents: vi.fn(),
  runWithRequestContext: vi.fn((_c, fn) => fn()),
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
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

vi.mock('@sentry/node', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    getCurrentScope: vi.fn(() => ({
      setUser: vi.fn(),
      setTag: vi.fn(),
      setTags: vi.fn(),
      setContext: vi.fn(),
      setExtra: vi.fn(),
      clear: vi.fn(),
    })),
    setUser: vi.fn(),
    setTag: vi.fn(),
    setTags: vi.fn(),
    setContext: vi.fn(),
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('../../services/audit-writer', () => ({ writeAuditLog: vi.fn(async () => undefined) }));

import { createCallerFactory } from '../../init';
import { portalAppRouter } from '../../portal-root';

const caller = createCallerFactory(portalAppRouter)({
  headers: new Headers({ cookie: `portal_session=${TOKEN}` }),
  session: null as never,
  user: null as never,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('portal.getUploadUrl — server-side MIME gate', () => {
  it('rejects a non-PDF content type with BAD_REQUEST before minting a URL', async () => {
    await expect(
      caller.portal.getUploadUrl({ filename: 'evil.exe', contentType: 'application/octet-stream' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(createPendingUploadMock).not.toHaveBeenCalled();
  });

  it('rejects an image content type with BAD_REQUEST', async () => {
    await expect(
      caller.portal.getUploadUrl({ filename: 'scan.png', contentType: 'image/png' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(createPendingUploadMock).not.toHaveBeenCalled();
  });

  it('accepts application/pdf and mints a presigned upload (no client storage key returned)', async () => {
    const out = await caller.portal.getUploadUrl({
      filename: 'invoice.pdf',
      contentType: 'application/pdf',
    });
    expect(createPendingUploadMock).toHaveBeenCalledTimes(1);
    expect(out.documentId).toBe('doc-1');
    expect(out.uploadUrl).toBe('https://r2.example.com/put');
    expect(out.storageKey).toBe('');
  });
});
