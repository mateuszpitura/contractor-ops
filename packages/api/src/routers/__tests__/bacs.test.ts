/**
 * bacsRouter unit tests.
 *
 * Covers:
 *  - validateSortCode (VALID / WARN paths via VocaLink modulus check)
 *  - getSubmitterMasks (configured / not configured)
 *  - saveSubmitterConfig (encryption + masking + audit log + happy path)
 *  - previewExport (PRECONDITION_FAILED when submitter not configured)
 *  - generateExport (FORBIDDEN-style refusal when submitter not configured;
 *    upload + Document + PaymentExport on happy path; rejection of files
 *    containing unmappable transliteration `?` chars)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'org-bacs-001';
const USER_ID = 'user-bacs-001';
const RUN_ID = 'run-bacs-001';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockPrisma, mockEncrypt, mockDecrypt, mockPutAndSign, mockEvaluate, mockWriteAuditLog } =
  vi.hoisted(() => {
    type Rec = Record<string, unknown>;

    const mockPrisma: Rec = {
      organization: {
        findUnique: vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
        update: vi.fn().mockResolvedValue({}),
      },
      paymentRun: {
        findFirst: vi.fn(),
      },
      document: {
        create: vi.fn().mockResolvedValue({ id: 'doc-1' }),
      },
      paymentExport: {
        create: vi.fn().mockResolvedValue({ id: 'export-1' }),
      },
      member: {
        findFirst: vi.fn().mockResolvedValue({ role: 'admin' }),
      },
      $transaction: vi.fn(async (fnOrArray: ((tx: Rec) => Promise<unknown>) | unknown[]) => {
        if (typeof fnOrArray === 'function') return fnOrArray(mockPrisma);
        return Promise.all(fnOrArray);
      }),
    };

    return {
      mockPrisma,
      mockEncrypt: vi.fn((plain: string) => `enc:${plain}`),
      mockDecrypt: vi.fn((blob: string) => blob.replace(/^enc:/, '')),
      mockPutAndSign: vi.fn(async () => ({
        signedUrl: 'https://signed.example/bacs.txt',
        expiresInSeconds: 300,
      })),
      mockEvaluate: vi.fn(),
      mockWriteAuditLog: vi.fn(async () => undefined),
    };
  });

// ---------------------------------------------------------------------------
// Module mocks (must be top-level)
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
  withRlsTransactions: <T,>(c: T) => c,
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

vi.mock('@contractor-ops/feature-flags', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    lazyFlagBag: () => ({
      isEnabled: (key: string) => mockEvaluate(key),
    }),
    evaluate: (key: string) => ({ enabled: mockEvaluate(key) }),
  };
});

vi.mock('../../services/bank-account-crypto.js', () => ({
  encryptBankAccount: mockEncrypt,
  decryptBankAccount: mockDecrypt,
}));

vi.mock('../../services/r2.js', () => ({
  maxBytesForMime: vi.fn(() => 10485760),
  MAX_BYTES_BY_MIME: { 'application/pdf': 52428800 },
  putObjectAndSignDownload: mockPutAndSign,
  signExistingDownload: vi.fn(),
}));

vi.mock('../../services/audit-writer.js', () => ({
  writeAuditLog: mockWriteAuditLog,
}));

// F-DB-03 — tenantMiddleware reads status/region via getOrgMeta. Stub it so
// individual tests can override `prisma.organization.findUnique` for the
// HANDLER's own DB lookup without inadvertently failing the tenant gate.
vi.mock('../../services/org-cache.js', () => ({
  getOrgMeta: vi.fn(async () => ({
    id: 'org-bacs-001',
    dataRegion: 'EU',
    status: 'ACTIVE',
    name: 'Test Org',
  })),
  invalidateOrgMeta: vi.fn(async () => undefined),
  ORG_META_TTL_SECONDS: 300,
  orgMetaKey: (orgId: string) => `org:${orgId}:meta`,
}));

vi.mock('@contractor-ops/logger', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn(), trace: vi.fn(), child: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createIntegrationLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
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

vi.mock('@sentry/nextjs', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    getCurrentScope: vi.fn(() => ({ setUser: vi.fn(), setTag: vi.fn(), setTags: vi.fn(), setContext: vi.fn(), setExtra: vi.fn(), clear: vi.fn() })),
    setUser: vi.fn(),
    setTag: vi.fn(),
    setTags: vi.fn(),
    setContext: vi.fn(),
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from '../../init.js';
import { bacsRouter } from '../finance/bacs.js';

const createCaller = createCallerFactory(bacsRouter);

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
      name: 'BACS Admin User',
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

beforeEach(() => {
  vi.clearAllMocks();
  mockEvaluate.mockReturnValue(true);
  // organization.findUnique default — caller-tenant DB lookup
  mockPrisma.organization.findUnique = vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' });
});

// ===========================================================================
// validateSortCode
// ===========================================================================

describe('bacsRouter.validateSortCode', () => {
  it('returns VALID when modulus check passes (sort code outside table range)', async () => {
    const result = await caller.validateSortCode({
      sortCode: '999999',
      accountNumber: '12345678',
    });
    expect(result.status).toBe('VALID');
    expect(result.warnings).toEqual([]);
  });

  it('rejects malformed sort codes via Zod (5 digits)', async () => {
    await expect(
      caller.validateSortCode({
        sortCode: '12345',
        accountNumber: '12345678',
      }),
    ).rejects.toThrow();
  });

  it('rejects malformed account numbers via Zod (7 digits)', async () => {
    await expect(
      caller.validateSortCode({
        sortCode: '123456',
        accountNumber: '1234567',
      }),
    ).rejects.toThrow();
  });
});

// ===========================================================================
// getSubmitterMasks
// ===========================================================================

describe('bacsRouter.getSubmitterMasks', () => {
  it('returns configured=false when no encrypted fields present', async () => {
    mockPrisma.organization.findUnique = vi.fn().mockResolvedValue({
      bacsServiceUserNumberMasked: null,
      bacsSubmitterSortCodeMasked: null,
      bacsSubmitterAccountNumberMasked: null,
      bacsSubmitterName: null,
    });
    const result = await caller.getSubmitterMasks();
    expect(result.configured).toBe(false);
  });

  it('returns configured=true with masks when all fields populated', async () => {
    mockPrisma.organization.findUnique = vi.fn().mockResolvedValue({
      bacsServiceUserNumberMasked: 'XXXX99',
      bacsSubmitterSortCodeMasked: 'XX-XX-56',
      bacsSubmitterAccountNumberMasked: 'XXXX5678',
      bacsSubmitterName: 'ACME LTD',
    });
    const result = await caller.getSubmitterMasks();
    expect(result.configured).toBe(true);
    expect(result.sun).toBe('XXXX99');
    expect(result.sortCode).toBe('XX-XX-56');
    expect(result.accountNumber).toBe('XXXX5678');
    expect(result.submitterName).toBe('ACME LTD');
  });

  it('throws NOT_FOUND when the organization row is absent (WR-06)', async () => {
    // WR-06 regression: a missing org row is a tenancy/region invariant
    // violation, NOT a 'submitter not configured' empty state. Returning
    // configured=false silently masked the failure mode and produced a
    // confusing UX (empty form -> save -> opaque error). Surface NOT_FOUND.
    mockPrisma.organization.findUnique = vi.fn().mockResolvedValue(null);
    await expect(caller.getSubmitterMasks()).rejects.toThrow(/Organization not found/i);
  });
});

// ===========================================================================
// saveSubmitterConfig
// ===========================================================================

describe('bacsRouter.saveSubmitterConfig', () => {
  it('encrypts every field, computes masks, updates org, and writes audit log', async () => {
    const result = await caller.saveSubmitterConfig({
      serviceUserNumber: '123456',
      submitterSortCode: '112233',
      submitterAccountNumber: '12345678',
      submitterName: 'ACME LTD',
    });

    expect(result.saved).toBe(true);
    expect(result.masks.sun).toBe('XXXX56');
    expect(result.masks.sortCode).toBe('XX-XX-33');
    expect(result.masks.accountNumber).toBe('XXXX5678');

    // Verify encryption was called for each sensitive field
    expect(mockEncrypt).toHaveBeenCalledWith('123456');
    expect(mockEncrypt).toHaveBeenCalledWith('112233');
    expect(mockEncrypt).toHaveBeenCalledWith('12345678');

    // Verify org was updated
    expect(mockPrisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ORG_ID },
        data: expect.objectContaining({
          bacsServiceUserNumberEncrypted: 'enc:123456',
          bacsServiceUserNumberMasked: 'XXXX56',
          bacsSubmitterName: 'ACME LTD',
        }),
      }),
    );

    // Verify audit log records FIELDS only, never values
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        action: 'BACS_SUBMITTER_CONFIG_UPDATED',
        resourceType: 'ORGANIZATION',
        metadata: expect.objectContaining({
          fieldsUpdated: expect.arrayContaining([
            'bacsServiceUserNumber',
            'bacsSubmitterSortCode',
            'bacsSubmitterAccountNumber',
            'bacsSubmitterName',
          ]),
        }),
      }),
    );

    // Audit metadata MUST NOT contain plaintext values (security)
    const auditCall = mockWriteAuditLog.mock.calls[0]?.[0] as Record<string, unknown>;
    const metadata = auditCall?.metadata as Record<string, unknown> | undefined;
    expect(JSON.stringify(metadata)).not.toContain('123456');
    expect(JSON.stringify(metadata)).not.toContain('12345678');
  });

  it('rejects malformed inputs via Zod (non-digit SUN)', async () => {
    await expect(
      caller.saveSubmitterConfig({
        serviceUserNumber: 'abcdef',
        submitterSortCode: '112233',
        submitterAccountNumber: '12345678',
        submitterName: 'ACME LTD',
      }),
    ).rejects.toThrow();
  });

  it('rejects submitter names containing forbidden BACS characters', async () => {
    await expect(
      caller.saveSubmitterConfig({
        serviceUserNumber: '123456',
        submitterSortCode: '112233',
        submitterAccountNumber: '12345678',
        // Lowercase / non-BACS chars not in the allowed set
        submitterName: 'naïve café',
      }),
    ).rejects.toThrow();
  });
});

// ===========================================================================
// previewExport / generateExport — submitter-not-configured paths
// ===========================================================================

describe('bacsRouter.previewExport / generateExport', () => {
  it('previewExport: throws PRECONDITION_FAILED when submitter not configured', async () => {
    mockPrisma.organization.findUnique = vi.fn().mockResolvedValue({
      bacsServiceUserNumberEncrypted: null,
    });

    await expect(caller.previewExport({ paymentRunId: RUN_ID })).rejects.toThrow(/not configured/i);
  });

  it('generateExport: throws PRECONDITION_FAILED when submitter not configured', async () => {
    mockPrisma.organization.findUnique = vi.fn().mockResolvedValue({
      bacsServiceUserNumberEncrypted: null,
    });

    await expect(caller.generateExport({ paymentRunId: RUN_ID })).rejects.toThrow(
      /not configured/i,
    );
  });

  it('generateExport: blocks download when contractor name contains unmappable CJK chars', async () => {
    // CR-01 regression: `transliterateToBacs.replaced` carries the ORIGINAL
    // unmappable Unicode character (e.g. '日'), never the literal '?'. The
    // server-side defensive guard MUST therefore key on `replaced.length > 0`,
    // not `replaced.includes('?')`. Before this fix, a CJK contractor name
    // would silently produce a BACS-rejecting file and a signed download URL.
    mockPrisma.organization.findUnique = vi.fn().mockResolvedValue({
      bacsServiceUserNumberEncrypted: 'enc:123456',
      bacsSubmitterSortCodeEncrypted: 'enc:112233',
      bacsSubmitterAccountNumberEncrypted: 'enc:12345678',
      bacsSubmitterName: 'ACME LTD',
      name: 'Acme Ltd',
    });
    mockPrisma.paymentRun.findFirst = vi.fn().mockResolvedValue({
      id: RUN_ID,
      runNumber: 'PR-CJK-001',
      organizationId: ORG_ID,
      status: 'LOCKED',
      currency: 'GBP',
      items: [
        {
          amountMinor: 10_000,
          currency: 'GBP',
          status: 'PENDING',
          paymentReference: 'INV-001',
          invoice: { invoiceNumber: 'INV-001' },
          contractor: { legalName: '日本商事' }, // unmappable CJK chars
          billingProfile: {
            ukSortCodeEncrypted: 'enc:123456',
            ukAccountNumberEncrypted: 'enc:87654321',
          },
        },
      ],
    });

    await expect(caller.generateExport({ paymentRunId: RUN_ID })).rejects.toThrow(
      /unmappable characters/i,
    );

    // Defense-in-depth: the file must NOT be uploaded to R2 when blocked.
    expect(mockPutAndSign).not.toHaveBeenCalled();
    // And no Document / PaymentExport audit rows should be written.
    expect(mockPrisma.document.create).not.toHaveBeenCalled();
    expect(mockPrisma.paymentExport.create).not.toHaveBeenCalled();
  });

  it('generateExport: rejects non-GBP payment runs (CR-02)', async () => {
    // CR-02 regression: BACS Standard 18 has no currency field — the entire
    // file is implicitly GBP. A €1000 invoice (amountMinor=100000) would
    // otherwise be misread by the recipient bank as £1000. The router MUST
    // refuse the run before reaching the generator.
    mockPrisma.organization.findUnique = vi.fn().mockResolvedValue({
      bacsServiceUserNumberEncrypted: 'enc:123456',
      bacsSubmitterSortCodeEncrypted: 'enc:112233',
      bacsSubmitterAccountNumberEncrypted: 'enc:12345678',
      bacsSubmitterName: 'ACME LTD',
      name: 'Acme Ltd',
    });
    mockPrisma.paymentRun.findFirst = vi.fn().mockResolvedValue({
      id: RUN_ID,
      runNumber: 'PR-EUR-001',
      organizationId: ORG_ID,
      status: 'LOCKED',
      currency: 'EUR',
      items: [
        {
          amountMinor: 100_000,
          currency: 'EUR',
          status: 'PENDING',
          paymentReference: 'INV-EUR-001',
          invoice: { invoiceNumber: 'INV-EUR-001' },
          contractor: { legalName: 'EU GMBH' },
          billingProfile: {
            ukSortCodeEncrypted: 'enc:123456',
            ukAccountNumberEncrypted: 'enc:87654321',
          },
        },
      ],
    });

    await expect(caller.generateExport({ paymentRunId: RUN_ID })).rejects.toThrow(/GBP/);
    expect(mockPutAndSign).not.toHaveBeenCalled();
  });

  it('generateExport: rejects DRAFT payment runs (WR-05)', async () => {
    // WR-05 regression: a DRAFT run is still mutable — the recipient list
    // could change between BACS file download and submission, and the
    // Document audit row would point to a 'version' of the run that no
    // longer exists. The router must require LOCKED+ for generateExport.
    mockPrisma.organization.findUnique = vi.fn().mockResolvedValue({
      bacsServiceUserNumberEncrypted: 'enc:123456',
      bacsSubmitterSortCodeEncrypted: 'enc:112233',
      bacsSubmitterAccountNumberEncrypted: 'enc:12345678',
      bacsSubmitterName: 'ACME LTD',
      name: 'Acme Ltd',
    });
    mockPrisma.paymentRun.findFirst = vi.fn().mockResolvedValue({
      id: RUN_ID,
      runNumber: 'PR-DRAFT-001',
      organizationId: ORG_ID,
      status: 'DRAFT',
      currency: 'GBP',
      items: [
        {
          amountMinor: 50_000,
          currency: 'GBP',
          status: 'PENDING',
          paymentReference: 'INV-DRAFT-001',
          invoice: { invoiceNumber: 'INV-DRAFT-001' },
          contractor: { legalName: 'CONTRACTOR LTD' },
          billingProfile: {
            ukSortCodeEncrypted: 'enc:123456',
            ukAccountNumberEncrypted: 'enc:87654321',
          },
        },
      ],
    });

    await expect(caller.generateExport({ paymentRunId: RUN_ID })).rejects.toThrow(
      /must be locked/i,
    );
    expect(mockPutAndSign).not.toHaveBeenCalled();
  });
});
