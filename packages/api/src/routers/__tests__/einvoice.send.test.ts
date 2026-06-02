/**
 * Phase 61 · Plan 61-06 Task 2 — einvoice.send router-level tests.
 *
 * Coverage (per plan §Task 2 behavior):
 *   1. Happy path — VALID lifecycle + sender ACTIVE + receiver CII → transmit
 *      success, lifecycle moves to SENT, transmissionId persisted, TRANSMITTED
 *      event written.
 *   2. Lifecycle INVALID → PRECONDITION_FAILED (KOSIT_VALIDATION_FAILED)
 *      without any HTTP call.
 *   3. Sender not ACTIVE → PRECONDITION_FAILED (PEPPOL_PARTICIPANT_NOT_ACTIVE).
 *   4. Receiver capability lookup returns no CII → PARTICIPANT_NOT_REACHABLE.
 *   5. Contractor missing peppolSchemeId/peppolParticipantValue →
 *      PARTICIPANT_NOT_REACHABLE.
 *   6. Storecove transmitInvoice returns `status: 'rejected'` → lifecycle
 *      moves to FAILED + DELIVERY_FAILED event written; router throws
 *      STORECOVE_TRANSMISSION_FAILED.
 *   7. Cross-tenant / unknown invoiceId → NOT_FOUND.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';
const USER_ID = 'clyyyyyyyyyyyyyyyyyyyyyyyy';
const INVOICE_ID = 'clinvoice000000000000000001';
const LIFECYCLE_ID = 'cllifecyc0000000000000000001';

const STORECOVE_CII_DOC_TYPE_ID =
  'urn:cen.eu:en16931:2017::CrossIndustryInvoice##urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0::2.1';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockPrisma, mockBuildAdapter, mockAdapter, mockGetObjectAsString } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn(async () => ({ dataRegion: 'EU', name: 'Test Org' })),
    },
    invoice: {
      findFirst: vi.fn(),
    },
    eInvoiceLifecycle: {
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    eInvoiceLifecycleEvent: {
      create: vi.fn(),
    },
    peppolParticipant: {
      findFirst: vi.fn(),
    },
    peppolCapabilityCache: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    member: { findFirst: vi.fn(async () => ({ role: 'admin' })) },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  const mockAdapter = {
    lookupParticipantCapabilities: vi.fn(),
    transmitInvoice: vi.fn(),
  };

  return {
    mockPrisma,
    mockBuildAdapter: vi.fn(async () => mockAdapter),
    mockAdapter,
    mockGetObjectAsString: vi.fn(async () => '<rsm:CrossIndustryInvoice/>'),
  };
});

// ---------------------------------------------------------------------------
// Mock modules
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

// F-DB-03 / F-SEC-12 — org-cache must report ACTIVE so tenant middleware
// does not throw orgSuspended.
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

vi.mock('@contractor-ops/einvoice', async importOriginal => {
  const actual = await importOriginal<typeof import('@contractor-ops/einvoice')>();
  return {
    ...actual,
    // Stub XRechnungDEProfile so `new XRechnungDEProfile()` is cheap.
    XRechnungDEProfile: class {
      async generateAndValidate() {
        return {
          xml: '<xml/>',
          report: { status: 'VALID', ruleSetVersion: 'XRechnung 3.0.2', layers: [] },
        };
      }
    },
  };
});

vi.mock('../../services/peppol-adapter-factory', () => ({
  buildStorecoveAdapterForOrg: mockBuildAdapter,
}));

vi.mock('../../services/r2', () => ({
  maxBytesForMime: vi.fn(() => 10485760),
  MAX_BYTES_BY_MIME: { 'application/pdf': 52428800 },
  putObjectString: vi.fn(async () => undefined),
  getObjectAsString: mockGetObjectAsString,
  signExistingDownload: vi.fn(async () => ({
    signedUrl: 'https://r2.example.com/download',
    expiresInSeconds: 300,
  })),
}));

vi.mock('../../services/cache', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
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

vi.mock('@contractor-ops/logger', () => ({
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
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
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

import { createCallerFactory } from '../../init';
import { appRouter } from '../../root';

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
// Fixture helpers
// ---------------------------------------------------------------------------

function makeInvoice(overrides?: {
  validationStatus?: 'VALID' | 'WARNINGS' | 'INVALID' | 'NOT_VALIDATED';
  transmissionStatus?: 'NOT_SENT' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';
  peppolSchemeId?: string | null;
  peppolParticipantValue?: string | null;
  xmlKey?: string | null;
}) {
  return {
    id: INVOICE_ID,
    organizationId: ORG_ID,
    contractor: {
      id: 'ctr-1',
      // Use hasOwnProperty semantics via `in`-check so an explicit `null`
      // override sticks (nullish coalescing would treat it as unset).
      peppolSchemeId:
        overrides && 'peppolSchemeId' in overrides ? overrides.peppolSchemeId : '0060',
      peppolParticipantValue:
        overrides && 'peppolParticipantValue' in overrides
          ? overrides.peppolParticipantValue
          : 'GB123',
    },
    eInvoiceLifecycle: {
      id: LIFECYCLE_ID,
      xmlKey: overrides?.xmlKey === undefined ? 'einvoice-xml/org/inv/abc.xml' : overrides.xmlKey,
      validationStatus: overrides?.validationStatus ?? 'VALID',
      transmissionStatus: overrides?.transmissionStatus ?? 'NOT_SENT',
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth.api.hasPermission).mockResolvedValue({ success: true } as never);
  vi.mocked(authApi.hasPermission).mockResolvedValue({ success: true } as never);
  // Default: sender is ACTIVE, receiver supports CII, no capability cache
  mockPrisma.peppolParticipant.findFirst.mockResolvedValue({
    id: 'part-1',
    status: 'ACTIVE',
    participantId: '0060:GB999',
  });
  mockPrisma.peppolCapabilityCache.findUnique.mockResolvedValue(null);
  mockPrisma.peppolCapabilityCache.upsert.mockResolvedValue(undefined);
  mockAdapter.lookupParticipantCapabilities.mockResolvedValue({
    schemeId: '0060',
    value: 'GB123',
    documentTypes: [STORECOVE_CII_DOC_TYPE_ID],
    fetchedAt: new Date(),
  });
  mockAdapter.transmitInvoice.mockResolvedValue({
    transmissionId: 'msg-1',
    status: 'accepted',
    timestamp: new Date(),
  });
  mockBuildAdapter.mockResolvedValue(mockAdapter);
});

describe('einvoice.send', () => {
  it('happy path — VALID lifecycle + ACTIVE sender + CII receiver → transmission succeeds + lifecycle moves to SENT + TRANSMITTED event written', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValueOnce(makeInvoice());

    const result = await caller.einvoice.send({ invoiceId: INVOICE_ID });

    expect(result.transmissionStatus).toBe('SENT');
    expect(result.transmissionId).toBe('msg-1');
    expect(mockAdapter.transmitInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        format: expect.objectContaining({ kind: 'cii-xrechnung' }),
        documentTypeId: STORECOVE_CII_DOC_TYPE_ID,
        organizationId: ORG_ID,
      }),
    );
    // Two lifecycle updates: QUEUED then SENT.
    expect(mockPrisma.eInvoiceLifecycle.update).toHaveBeenCalledTimes(2);
    const sentUpdateCall = mockPrisma.eInvoiceLifecycle.update.mock.calls.find((c: unknown[]) => {
      const arg = c[0] as { data?: { transmissionStatus?: string } };
      return arg.data?.transmissionStatus === 'SENT';
    });
    expect(sentUpdateCall).toBeDefined();
    // TRANSMITTED event written.
    const eventTypes = mockPrisma.eInvoiceLifecycleEvent.create.mock.calls.map(
      (c: unknown[]) => (c[0] as { data: { eventType: string } }).data.eventType,
    );
    expect(eventTypes).toContain('TRANSMITTED');
  });

  it('refuses to send when lifecycle status is INVALID (KOSIT_VALIDATION_FAILED, no HTTP call)', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValueOnce(
      makeInvoice({ validationStatus: 'INVALID' }),
    );

    await expect(caller.einvoice.send({ invoiceId: INVOICE_ID })).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: 'kositValidationFailed',
    });

    expect(mockAdapter.transmitInvoice).not.toHaveBeenCalled();
  });

  it('refuses to send when sender PeppolParticipant is not ACTIVE (PEPPOL_PARTICIPANT_NOT_ACTIVE)', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValueOnce(makeInvoice());
    // Override default — no ACTIVE participant exists for this org.
    mockPrisma.peppolParticipant.findFirst.mockReset();
    mockPrisma.peppolParticipant.findFirst.mockResolvedValue(null);

    await expect(caller.einvoice.send({ invoiceId: INVOICE_ID })).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: 'PEPPOL_PARTICIPANT_NOT_ACTIVE',
    });

    expect(mockAdapter.transmitInvoice).not.toHaveBeenCalled();
  });

  it('refuses to send when contractor lacks peppolSchemeId / peppolParticipantValue (PARTICIPANT_NOT_REACHABLE)', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValueOnce(
      makeInvoice({ peppolSchemeId: null, peppolParticipantValue: null }),
    );

    await expect(caller.einvoice.send({ invoiceId: INVOICE_ID })).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: 'PARTICIPANT_NOT_REACHABLE',
    });

    expect(mockAdapter.transmitInvoice).not.toHaveBeenCalled();
  });

  it('refuses to send when receiver capability lookup returns no CII doc type (PARTICIPANT_NOT_REACHABLE)', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValueOnce(makeInvoice());
    mockAdapter.lookupParticipantCapabilities.mockResolvedValueOnce({
      schemeId: '0060',
      value: 'GB123',
      documentTypes: ['urn:peppol:bis:3'], // UBL-only, no CII
      fetchedAt: new Date(),
    });

    await expect(caller.einvoice.send({ invoiceId: INVOICE_ID })).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: 'PARTICIPANT_NOT_REACHABLE',
    });

    expect(mockAdapter.transmitInvoice).not.toHaveBeenCalled();
  });

  it('on transmitInvoice rejected status → lifecycle moves to FAILED + DELIVERY_FAILED event + throws STORECOVE_TRANSMISSION_FAILED', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValueOnce(makeInvoice());
    mockAdapter.transmitInvoice.mockResolvedValueOnce({
      transmissionId: '',
      status: 'rejected',
      timestamp: new Date(),
      errors: [{ code: 'E1', message: 'boom' }],
    });

    await expect(caller.einvoice.send({ invoiceId: INVOICE_ID })).rejects.toMatchObject({
      code: 'BAD_GATEWAY',
      message: 'storecoveTransmissionFailed',
    });

    // Lifecycle gets FAILED state.
    const failedUpdate = mockPrisma.eInvoiceLifecycle.update.mock.calls.find((c: unknown[]) => {
      const arg = c[0] as { data?: { transmissionStatus?: string } };
      return arg.data?.transmissionStatus === 'FAILED';
    });
    expect(failedUpdate).toBeDefined();

    // DELIVERY_FAILED event written.
    const eventTypes = mockPrisma.eInvoiceLifecycleEvent.create.mock.calls.map(
      (c: unknown[]) => (c[0] as { data: { eventType: string } }).data.eventType,
    );
    expect(eventTypes).toContain('DELIVERY_FAILED');
  });

  it('NOT_FOUND when invoiceId does not belong to the caller tenant (or does not exist)', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValueOnce(null);

    await expect(caller.einvoice.send({ invoiceId: INVOICE_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'einvoiceLifecycleNotFound',
    });

    expect(mockAdapter.transmitInvoice).not.toHaveBeenCalled();
  });
});
