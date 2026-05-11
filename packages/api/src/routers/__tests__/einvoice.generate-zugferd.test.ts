// packages/api/src/routers/__tests__/einvoice.generate-zugferd.test.ts
//
// Phase 62 · Plan 62-05 Task 2 — unit tests for the outbound
// `einvoice.generateZugferdPdf` mutation. The einvoice package's own test
// suite covers the generator pipeline; here we verify:
//   - auth + org-scope enforcement,
//   - idempotency (same sha → reuse existing key, no second event),
//   - typed error translation (level-unsupported, internal),
//   - lifecycle upsert + event write atomicity.
//
// The `@contractor-ops/einvoice` module is mocked at the boundary so we
// never touch pdf-lib / react-pdf / the real CII generator.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_A = 'clxxxxxxxxxxxxxxxxxxxxxxxa';
const ORG_B = 'clxxxxxxxxxxxxxxxxxxxxxxxb';
const USER_A = 'clyyyyyyyyyyyyyyyyyyyyyyya';
const INVOICE_ID = 'clinvoiceaaaaaaaaaaaaaaaaa';
const INVOICE_ID_B = 'clinvoicebbbbbbbbbbbbbbbbb';
const LIFECYCLE_ID = 'cllifecycleaaaaaaaaaaaaaaa';

// Deterministic PDF bytes → stable SHA-256 in tests.
const MOCK_PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockPrisma,
  mockGenerateZugferdPdf,
  mockPutObjectAndSignDownload,
  mockSignExistingDownload,
  mockMapPrismaInvoiceToEInvoice,
  lifecycleEvents,
  lifecycleUpserts,
} = vi.hoisted(() => {
  type Rec = Record<string, unknown>;
  const lifecycleEvents: Rec[] = [];
  const lifecycleUpserts: Rec[] = [];

  const mockPrisma: Rec = {
    invoice: {
      findFirst: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(async () => ({ dataRegion: 'EU', status: 'ACTIVE' })),
    },
    member: { findFirst: vi.fn(async () => ({ role: 'admin' })) },
    eInvoiceLifecycle: {
      upsert: vi.fn(async (args: { create: Rec; update: Rec }) => {
        lifecycleUpserts.push(args.create ?? args.update);
        return { id: LIFECYCLE_ID };
      }),
    },
    eInvoiceLifecycleEvent: {
      create: vi.fn(async (args: { data: Rec }) => {
        lifecycleEvents.push(args.data);
        return { id: `event_${lifecycleEvents.length}` };
      }),
    },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return {
    mockPrisma,
    mockGenerateZugferdPdf: vi.fn(async () => MOCK_PDF_BYTES),
    mockPutObjectAndSignDownload: vi.fn(async (p: { key: string }) => ({
      signedUrl: `https://r2.test/${p.key}?sig=mock`,
      expiresInSeconds: 300,
    })),
    mockSignExistingDownload: vi.fn(async (key: string) => ({
      signedUrl: `https://r2.test/${key}?sig=reused`,
      expiresInSeconds: 300,
    })),
    mockMapPrismaInvoiceToEInvoice: vi.fn(() => ({
      id: 'INV-001',
      issueDate: '2026-04-14',
      dueDate: '2026-05-14',
      invoiceTypeCode: '380',
      currencyCode: 'EUR',
      profileId: 'xrechnung-de',
      supplier: { id: 'DE123', name: 'Alpha', country: 'DE' },
      customer: { id: 'DE456', name: 'Buyer', country: 'DE' },
      lines: [],
      taxExclusiveAmount: 0,
      taxInclusiveAmount: 0,
      payableAmount: 0,
      taxBreakdown: [],
    })),
    lifecycleEvents,
    lifecycleUpserts,
  };
});

// ---------------------------------------------------------------------------
// Module mocks
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

// Mock the whole einvoice package — avoids loading the real generator,
// pdf-lib, react-pdf, KoSIT validator, etc. Returns the shapes the router
// consumes plus the ZugferdLevelUnsupportedForOutput class our test uses.
vi.mock('@contractor-ops/einvoice', () => {
  class ZugferdLevelUnsupportedForOutput extends Error {
    readonly code = 'ZUGFERD_LEVEL_UNSUPPORTED_FOR_OUTPUT' as const;
    constructor(public readonly level: string) {
      super(`Outbound ZUGFeRD only supports COMFORT; got ${level}`);
      this.name = 'ZugferdLevelUnsupportedForOutput';
    }
  }
  return {
    generateZugferdPdf: mockGenerateZugferdPdf,
    ZugferdLevelUnsupportedForOutput,
    computeKsefComplianceStatus: vi.fn(),
    listProfiles: vi.fn(() => []),
    STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID: 'doc-type',
    XRECHNUNG_CUSTOMIZATION_ID: 'xrechnung-3.0',
    XRECHNUNG_PROFILE_ID: 'xrechnung-de',
    KOSIT_RULE_SET_VERSION: 'test',
    XRECHNUNG_DE_PROFILE_ID: 'xrechnung-de',
    XRechnungDEProfile: class {
      async generateAndValidate() {
        return { xml: '<xml/>', report: { status: 'VALID', ruleSetVersion: 'x', layers: [] } };
      }
      async validateRich() {
        return { status: 'VALID', ruleSetVersion: 'x', layers: [] };
      }
      async getComplianceStatus() {
        return { profileId: 'xrechnung-de', status: 'active', label: 'x' };
      }
    },
  };
});

vi.mock('../../services/einvoice-finalize', () => ({
  mapPrismaInvoiceToEInvoice: mockMapPrismaInvoiceToEInvoice,
  finalizeEInvoice: vi.fn(),
  EInvoiceInvoiceNotFoundError: class extends Error {
    readonly code = 'EINVOICE_INVOICE_NOT_FOUND';
  },
  EInvoiceAlreadyFinalizedError: class extends Error {
    readonly code = 'EINVOICE_ALREADY_FINALIZED';
  },
}));

vi.mock('../../services/einvoice-lifecycle-fsm', () => ({
  IllegalFsmTransitionError: class extends Error {},
  transitionTransmission: vi.fn(),
}));

vi.mock('../../services/peppol-adapter-factory', () => ({
  buildStorecoveAdapterForOrg: vi.fn(),
}));

vi.mock('../../services/peppol-capability', () => ({
  assertReceiverAcceptsXRechnung: vi.fn(),
  assertSenderParticipantActive: vi.fn(),
  PARTICIPANT_NOT_REACHABLE: 'participant-not-reachable',
  PEPPOL_PARTICIPANT_NOT_ACTIVE: 'participant-not-active',
}));

vi.mock('../../services/r2', () => ({
  maxBytesForMime: vi.fn(() => 10485760),
  MAX_BYTES_BY_MIME: { 'application/pdf': 52428800 },
  signExistingDownload: mockSignExistingDownload,
  putObjectAndSignDownload: mockPutObjectAndSignDownload,
  putObjectString: vi.fn(async () => undefined),
  getObjectAsString: vi.fn(async () => '<xml/>'),
  createPresignedUploadUrl: vi.fn(),
  createPresignedDownloadUrl: vi.fn(),
  generateStorageKey: vi.fn(() => 'k'),
  headObject: vi.fn(),
  deleteObject: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => {
  const span = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
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
    startSpan: vi.fn((_o: unknown, fn: (s: typeof span) => unknown) => fn(span)),
    captureException: vi.fn(),
  };
});

vi.mock('@contractor-ops/logger', () => {
  const child = () => {
    const methods = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: () => child(),
    };
    return methods;
  };
  const l = child();
  return {
    runWithRequestContext: vi.fn((_c, fn) => fn()),
    getRequestId: vi.fn(() => undefined),
    getTraceparent: vi.fn(() => undefined),
    buildContextFromHeaders: vi.fn(() => ({})),
    getOutboundHeaders: vi.fn(() => ({})),
    generateRequestId: vi.fn(() => 'test-request-id'),
    withBodyLogging: vi.fn((_o, fn) => fn),
    logIntegrationCall: vi.fn(),
    subscribeOpossumEvents: vi.fn(),
    LOG_BODY_INCLUDE_PREFIXES: [],
    PII_MASK_KEYWORDS: [],
    PII_MASK_PATHS: [],

    logger: l,
    createLogger: vi.fn(() => l),
    createTrpcLogger: vi.fn(() => l),
  };
});

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto';

import { TRPCError } from '@trpc/server';
import { createCallerFactory } from '../../init';
import { einvoiceRouter } from '../core/einvoice';

const createCaller = createCallerFactory(einvoiceRouter);

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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EXPECTED_SHA = createHash('sha256').update(Buffer.from(MOCK_PDF_BYTES)).digest('hex');

function invoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: INVOICE_ID,
    organizationId: ORG_A,
    eInvoiceLifecycle: null,
    // Phase 68 D-06 cascade defaults — empty arrays mean no Skonto.
    skontoTerms: [] as unknown[],
    contractor: { id: 'ctr_default', billingProfiles: [] as unknown[] },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  lifecycleEvents.length = 0;
  lifecycleUpserts.length = 0;
  mockGenerateZugferdPdf.mockResolvedValue(MOCK_PDF_BYTES);
});

// ===========================================================================
// Tests
// ===========================================================================

describe('einvoice.generateZugferdPdf', () => {
  it('1. happy path: generates PDF, uploads, writes lifecycle + ZUGFERD_GENERATED event', async () => {
    mockPrisma.invoice.findFirst = vi.fn(async () => invoiceRow());

    const caller = makeCaller();
    const result = await caller.generateZugferdPdf({ invoiceId: INVOICE_ID });

    expect(result.pdfKey).toMatch(new RegExp(`^einvoice-pdf/${ORG_A}/${INVOICE_ID}/`));
    expect(result.pdfKey).toContain(EXPECTED_SHA.slice(0, 16));
    expect(result.signedUrl).toMatch(/^https:\/\/r2\.test\//);
    expect(result.expiresInSeconds).toBe(300);
    expect(result.reused).toBe(false);

    // One generator call, one R2 put, no sign-existing.
    expect(mockGenerateZugferdPdf).toHaveBeenCalledTimes(1);
    expect(mockPutObjectAndSignDownload).toHaveBeenCalledTimes(1);
    expect(mockSignExistingDownload).not.toHaveBeenCalled();

    // Lifecycle upsert + exactly one ZUGFERD_GENERATED event.
    expect(lifecycleUpserts).toHaveLength(1);
    expect(lifecycleUpserts[0]?.zugferdPdfSha256).toBe(EXPECTED_SHA);
    expect(lifecycleUpserts[0]?.profileId).toBe('zugferd-de');
    expect(lifecycleEvents).toHaveLength(1);
    expect(lifecycleEvents[0]?.eventType).toBe('ZUGFERD_GENERATED');
    expect((lifecycleEvents[0]?.detailsJson as { sha256: string }).sha256).toBe(EXPECTED_SHA);
    expect(lifecycleEvents[0]?.actorUserId).toBe(USER_A);
  });

  it('2. idempotent: second call with existing matching sha reuses key, no second event', async () => {
    const existingKey = `einvoice-pdf/${ORG_A}/${INVOICE_ID}/${EXPECTED_SHA.slice(0, 16)}.pdf`;
    const existingLifecycle = {
      id: LIFECYCLE_ID,
      zugferdPdfKey: existingKey,
      zugferdPdfSha256: EXPECTED_SHA,
      zugferdGeneratedAt: new Date('2026-04-10T00:00:00Z'),
    };
    mockPrisma.invoice.findFirst = vi.fn(async () =>
      invoiceRow({ eInvoiceLifecycle: existingLifecycle }),
    );

    const caller = makeCaller();
    const result = await caller.generateZugferdPdf({ invoiceId: INVOICE_ID });

    expect(result.reused).toBe(true);
    expect(result.pdfKey).toBe(existingKey);

    // No upload, no second event, no lifecycle write.
    expect(mockPutObjectAndSignDownload).not.toHaveBeenCalled();
    expect(lifecycleEvents).toHaveLength(0);
    expect(lifecycleUpserts).toHaveLength(0);
    expect(mockSignExistingDownload).toHaveBeenCalledWith(existingKey, 300);
  });

  it('3. cross-org access returns NOT_FOUND (never FORBIDDEN)', async () => {
    // findFirst filters by { id, organizationId } — cross-org caller finds nothing.
    mockPrisma.invoice.findFirst = vi.fn(
      async (args: { where: { id: string; organizationId: string } }) => {
        if (args.where.organizationId === ORG_A && args.where.id === INVOICE_ID) {
          return invoiceRow();
        }
        return null;
      },
    );

    const callerB = makeCaller('user_B', ORG_B);
    try {
      await callerB.generateZugferdPdf({ invoiceId: INVOICE_ID });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe('NOT_FOUND');
    }

    // Nothing was written.
    expect(mockGenerateZugferdPdf).not.toHaveBeenCalled();
    expect(mockPutObjectAndSignDownload).not.toHaveBeenCalled();
    expect(lifecycleEvents).toHaveLength(0);
  });

  it('4. generator throws → router returns INTERNAL_SERVER_ERROR with ZUGFERD_WRAPPING_FAILED', async () => {
    mockPrisma.invoice.findFirst = vi.fn(async () => invoiceRow());
    mockGenerateZugferdPdf.mockRejectedValueOnce(new Error('PDF wrapping exploded'));

    const caller = makeCaller();
    try {
      await caller.generateZugferdPdf({ invoiceId: INVOICE_ID });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      const trpcErr = err as TRPCError;
      expect(trpcErr.code).toBe('INTERNAL_SERVER_ERROR');
      expect(trpcErr.message).toBe('ZUGFERD_WRAPPING_FAILED');
    }

    expect(mockPutObjectAndSignDownload).not.toHaveBeenCalled();
    expect(lifecycleEvents).toHaveLength(0);
  });

  it('4b. ZugferdLevelUnsupportedForOutput → UNPROCESSABLE_CONTENT', async () => {
    mockPrisma.invoice.findFirst = vi.fn(async () => invoiceRow());
    const einvoice = await import('@contractor-ops/einvoice');
    mockGenerateZugferdPdf.mockRejectedValueOnce(
      new einvoice.ZugferdLevelUnsupportedForOutput('EXTENDED'),
    );

    const caller = makeCaller();
    try {
      await caller.generateZugferdPdf({ invoiceId: INVOICE_ID });
      throw new Error('expected throw');
    } catch (err) {
      expect((err as TRPCError).code).toBe('UNPROCESSABLE_CONTENT');
      expect((err as TRPCError).message).toBe('ZUGFERD_LEVEL_UNSUPPORTED_FOR_OUTPUT');
    }
  });

  it('5. new lifecycle row is created when none existed (upsert create branch)', async () => {
    mockPrisma.invoice.findFirst = vi.fn(async () => invoiceRow({ eInvoiceLifecycle: null }));

    const caller = makeCaller();
    await caller.generateZugferdPdf({ invoiceId: INVOICE_ID });

    expect(mockPrisma.eInvoiceLifecycle.upsert).toHaveBeenCalled();
    const upsertCall = vi.mocked(mockPrisma.eInvoiceLifecycle.upsert).mock.calls[0]?.[0] as {
      create: { profileId: string; invoiceId: string; organizationId: string };
      update: Record<string, unknown>;
      where: Record<string, unknown>;
    };
    expect(upsertCall.create.profileId).toBe('zugferd-de');
    expect(upsertCall.create.invoiceId).toBe(INVOICE_ID);
    expect(upsertCall.create.organizationId).toBe(ORG_A);
  });

  it('6. invalid cuid at input layer rejects before DB is touched', async () => {
    mockPrisma.invoice.findFirst = vi.fn(async () => invoiceRow());
    const caller = makeCaller();
    await expect(caller.generateZugferdPdf({ invoiceId: 'not-a-cuid' })).rejects.toThrow();
    expect(mockPrisma.invoice.findFirst).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Phase 68 · Plan 05 — Skonto cascade plumbing (Layer C router boundary)
//
// Closes the audit I-1 router half for the ZUGFeRD path. The embedded
// factur-x.xml end-to-end emission is locked by Plan 04
// (packages/einvoice/src/profiles/zugferd-de/__tests__/generator.test.ts);
// here we verify the api router resolves the cascade and forwards the
// resolved term to the einvoice-package generator.
// ===========================================================================

describe('einvoice.generateZugferdPdf — Skonto BG-20 cascade plumbing (Phase 68 D-06)', () => {
  it('forwards invoice-level SkontoTerm into generateZugferdPdf opts when set on the invoice', async () => {
    mockPrisma.invoice.findFirst = vi.fn(async () =>
      invoiceRow({
        skontoTerms: [
          {
            id: 'sk_inv_1',
            discountPercent: 3,
            discountPeriodDays: 7,
            netPeriodDays: 30,
          },
        ],
        // Profile-default deliberately set to a different value to prove
        // invoice-level term wins (matches services/skonto.ts:51 cascade).
        contractor: {
          id: 'ctr_1',
          billingProfiles: [
            {
              id: 'bp_1',
              skontoTerms: [
                {
                  id: 'sk_prof_1',
                  discountPercent: 99,
                  discountPeriodDays: 1,
                  netPeriodDays: 99,
                },
              ],
            },
          ],
        },
      }),
    );

    const caller = makeCaller();
    await caller.generateZugferdPdf({ invoiceId: INVOICE_ID });

    expect(mockGenerateZugferdPdf).toHaveBeenCalledTimes(1);
    expect(mockGenerateZugferdPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        skontoTerm: {
          discountPercent: 3,
          discountPeriodDays: 7,
          netPeriodDays: 30,
        },
      }),
    );
  });

  it('falls back to billing-profile-default SkontoTerm when invoice-level term is absent', async () => {
    mockPrisma.invoice.findFirst = vi.fn(async () =>
      invoiceRow({
        skontoTerms: [],
        contractor: {
          id: 'ctr_1',
          billingProfiles: [
            {
              id: 'bp_1',
              skontoTerms: [
                {
                  id: 'sk_prof_1',
                  discountPercent: 2,
                  discountPeriodDays: 14,
                  netPeriodDays: 60,
                },
              ],
            },
          ],
        },
      }),
    );

    const caller = makeCaller();
    await caller.generateZugferdPdf({ invoiceId: INVOICE_ID });

    expect(mockGenerateZugferdPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        skontoTerm: {
          discountPercent: 2,
          discountPeriodDays: 14,
          netPeriodDays: 60,
        },
      }),
    );
  });

  it('passes skontoTerm = null when neither invoice nor billing profile has a SkontoTerm', async () => {
    mockPrisma.invoice.findFirst = vi.fn(async () => invoiceRow()); // defaults: empty arrays

    const caller = makeCaller();
    await caller.generateZugferdPdf({ invoiceId: INVOICE_ID });

    expect(mockGenerateZugferdPdf).toHaveBeenCalledWith(
      expect.objectContaining({ skontoTerm: null }),
    );
  });
});

// Avoid unused-vars lint on INVOICE_ID_B.
void INVOICE_ID_B;
