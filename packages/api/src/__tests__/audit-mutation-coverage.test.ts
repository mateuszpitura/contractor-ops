/**
 * Audit-row coverage for sensitive mutations.
 *
 * Proves that the sensitive staff + portal mutations either DO write an
 * AuditLog row through the shared `writeAuditLog` path (with the correct
 * action / resourceType / actorType, and `tx` for the same-transaction
 * cases), or — where the source does NOT currently audit — locks that fact
 * so a future audit addition is a deliberate, test-visible change.
 *
 * Strategy mirrors `gulf-override-audit.test.ts` and
 * `compliance-portal-upload.test.ts`:
 *   - one hoisted in-memory `mockPrisma` with an observable `$transaction`,
 *   - `@contractor-ops/db` / `@contractor-ops/auth` / logger / feature-flags
 *     / Sentry mocked,
 *   - `../services/audit-writer` `writeAuditLog` replaced with a spy,
 *   - the REAL `appRouter` / `portalAppRouter` driven via `createCallerFactory`.
 *
 * Because the spy stands in for `writeAuditLog`, the `tx` argument the router
 * threads is captured verbatim: for the same-tx mutations the spy call carries
 * a defined `tx` (the transaction client), proving the audit row commits
 * atomically with the business mutation.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'cluseraaaaaaaaaaaaaaaaaaaaa';
const TARGET_USER_ID = 'cltargetuseraaaaaaaaaaaaaaa';
const API_KEY_ID = 'clapikeyaaaaaaaaaaaaaaaaaaa';
const RUN_ID = 'clrun000000000000000000001';
const FLOW_ID = 'clflow00000000000000000001';
const TRIGGER_ID = 'cltrigaaaaaaaaaaaaaaaaaaaaa';
const CONTRACTOR_ID = 'clcontractoraaaaaaaaaaaaaaa';
const ITEM_ID = 'clitemaaaaaaaaaaaaaaaaaaaaa';
const DOC_ID = 'cldocaaaaaaaaaaaaaaaaaaaaaa';
const RETURN_ID = 'clreturnaaaaaaaaaaaaaaaaaaa';
const STORAGE_KEY = `orgs/${ORG_ID}/docs/${DOC_ID}/file.pdf`;

// ---------------------------------------------------------------------------
// Hoisted mock state
// ---------------------------------------------------------------------------

const {
  mockPrisma,
  auditWriteSpy,
  getSubscriptionMock,
  validatePortalSessionMock,
  consumePendingUploadMock,
} = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const member = {
    findFirst: vi.fn(async () => ({ id: 'clmemberaaaaaaaaaaaaaaaaaaa', role: 'staff' })),
    findFirstOrThrow: vi.fn(async () => ({
      id: 'clmemberaaaaaaaaaaaaaaaaaaa',
      role: 'staff',
    })),
    count: vi.fn(async () => 3),
    update: vi.fn(async (args: { data: Rec }) => ({
      id: 'clmemberaaaaaaaaaaaaaaaaaaa',
      userId: 'cltargetuseraaaaaaaaaaaaaaa',
      organizationId: 'clorgaaaaaaaaaaaaaaaaaaaaaa',
      disabledAt: (args.data.disabledAt as Date | null) ?? null,
    })),
  };

  const approvalStep = {
    findMany: vi.fn(async () => []),
    update: vi.fn(async () => ({})),
  };

  const contractor = {
    findMany: vi.fn(async () => []),
    findFirst: vi.fn(async () => ({
      id: 'clcontractoraaaaaaaaaaaaaaa',
      displayName: 'Old Name',
      phone: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      postalCode: null,
      countryCode: 'PL',
    })),
    updateMany: vi.fn(async () => ({ count: 0 })),
    update: vi.fn(async (args: { data: Rec }) => ({
      id: 'clcontractoraaaaaaaaaaaaaaa',
      displayName: (args.data.displayName as string) ?? 'Updated',
      phone: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      postalCode: null,
      countryCode: 'PL',
    })),
  };

  const organizationApiKey = {
    count: vi.fn(async () => 0),
    findFirst: vi.fn(async () => ({
      id: 'clapikeyaaaaaaaaaaaaaaaaaaa',
      name: 'CI key',
      prefix: 'cops_live_abcd',
      scopes: ['contractor:read'],
      revokedAt: null,
    })),
    create: vi.fn(async (args: { data: Rec }) => ({
      id: 'clapikeyaaaaaaaaaaaaaaaaaaa',
      name: args.data.name,
      prefix: 'cops_live_abcd',
      scopes: args.data.scopes,
      expiresAt: null,
      createdAt: new Date('2026-01-01'),
    })),
    update: vi.fn(async () => ({})),
  };

  const paymentRun = {
    findFirst: vi.fn(async () => ({
      id: 'clrun000000000000000000001',
      organizationId: 'clorgaaaaaaaaaaaaaaaaaaaaaa',
      runNumber: 'PR-001',
      status: 'DRAFT',
      currency: 'PLN',
      items: [],
    })),
    findFirstOrThrow: vi.fn(async () => ({
      id: 'clrun000000000000000000001',
      organizationId: 'clorgaaaaaaaaaaaaaaaaaaaaaa',
      runNumber: 'PR-001',
      status: 'EXPORTED',
      currency: 'PLN',
    })),
    updateMany: vi.fn(async () => ({ count: 1 })),
  };

  const paymentRunItem = {
    findMany: vi.fn(async () => []),
    aggregate: vi.fn(async () => ({ _sum: { amountMinor: 0 }, _count: 0 })),
  };

  const paymentExport = {
    create: vi.fn(async (args: { data: Rec }) => ({ id: 'export_1', ...args.data })),
  };

  const approvalFlow = {
    findUniqueOrThrow: vi.fn(async () => ({
      id: 'clflow00000000000000000001',
      organizationId: 'clorgaaaaaaaaaaaaaaaaaaaaaa',
      status: 'PENDING_COMPLIANCE',
      resourceType: 'INVOICE',
      resourceId: 'clinvoiceaaaaaaaaaaaaaaaaaa',
    })),
    update: vi.fn(async () => ({})),
  };

  const invoice = {
    findUniqueOrThrow: vi.fn(async () => ({ contractorId: 'clcontractoraaaaaaaaaaaaaaa' })),
  };

  const reassessmentTrigger = {
    findFirst: vi.fn(async () => ({
      id: 'cltrigaaaaaaaaaaaaaaaaaaaaa',
      organizationId: 'clorgaaaaaaaaaaaaaaaaaaaaaa',
      status: 'OPEN',
      contractorAssignmentId: 'classignmentaaaaaaaaaaaaaa',
      contractorAssignment: { contractorId: 'clcontractoraaaaaaaaaaaaaaa' },
    })),
    update: vi.fn(async (args: { data: Rec }) => ({
      id: 'cltrigaaaaaaaaaaaaaaaaaaaaa',
      status: (args.data.status as string) ?? 'ACKNOWLEDGED',
    })),
  };

  const contractorComplianceItem = {
    findFirst: vi.fn(async () => ({
      id: 'clitemaaaaaaaaaaaaaaaaaaaaa',
      contractorId: 'clcontractoraaaaaaaaaaaaaaa',
      status: 'EXPIRED',
    })),
    findMany: vi.fn(async () => []),
    update: vi.fn(async () => ({ id: 'clitemaaaaaaaaaaaaaaaaaaaaa' })),
  };

  const document = {
    create: vi.fn(async () => ({ id: 'cldocaaaaaaaaaaaaaaaaaaaaaa', status: 'PENDING_REVIEW' })),
  };
  const documentLink = { create: vi.fn(async () => ({ id: 'link_1' })) };

  const equipmentAssignment = {
    findMany: vi.fn(async () => [
      { id: 'assign_1', equipment: { id: 'equip_1', name: 'Laptop', status: 'ASSIGNED' } },
    ]),
  };
  const equipment = { updateMany: vi.fn(async () => ({ count: 1 })) };

  const returnRequest = {
    findFirst: vi.fn(async () => ({
      id: 'clreturnaaaaaaaaaaaaaaaaaaa',
      status: 'PENDING_APPROVAL',
      contractorId: 'clcontractoraaaaaaaaaaaaaaa',
      organizationId: 'clorgaaaaaaaaaaaaaaaaaaaaaa',
    })),
    create: vi.fn(async (args: { data: Rec }) => ({
      id: 'clreturnaaaaaaaaaaaaaaaaaaa',
      ...args.data,
    })),
    update: vi.fn(async (args: { data: Rec }) => ({
      id: 'clreturnaaaaaaaaaaaaaaaaaaa',
      ...args.data,
    })),
  };

  const organization = {
    // Tenant + portal middleware read dataRegion/status from here.
    findUnique: vi.fn(async () => ({ dataRegion: 'EU', status: 'ACTIVE' })),
    findUniqueOrThrow: vi.fn(async () => ({
      countryCode: 'DE',
      isKleinunternehmer: false,
    })),
    update: vi.fn(async (args: { data: Rec }) => ({
      isKleinunternehmer: (args.data.isKleinunternehmer as boolean) ?? false,
    })),
  };

  const base: Rec = {
    member,
    approvalStep,
    contractor,
    organizationApiKey,
    paymentRun,
    paymentRunItem,
    paymentExport,
    approvalFlow,
    invoice,
    reassessmentTrigger,
    contractorComplianceItem,
    document,
    documentLink,
    equipmentAssignment,
    equipment,
    returnRequest,
    organization,
    auditLog: {
      create: vi.fn(async () => ({ id: 'audit_1' })),
      createMany: vi.fn(async () => ({ count: 0 })),
    },
    paymentRunComplianceCheck: { create: vi.fn(async () => ({ id: 'check_1' })) },
  };

  const mockPrisma: Rec = {
    ...base,
    $transaction: vi.fn(async (fn: (tx: Rec) => unknown) => fn(mockPrisma)),
    $queryRaw: vi.fn(async () => []),
    // Sensitive mutations enqueue a transactional-outbox row via raw SQL in the
    // same tx; the enqueue reports one affected row so the mutation proceeds.
    $executeRawUnsafe: vi.fn(async () => 1),
    $queryRawUnsafe: vi.fn(async () => []),
  };

  return {
    mockPrisma,
    auditWriteSpy: vi.fn(async () => undefined),
    getSubscriptionMock: vi.fn(async () => ({
      tier: 'ENTERPRISE',
      status: 'ACTIVE',
    })),
    validatePortalSessionMock: vi.fn(),
    consumePendingUploadMock: vi.fn(async () => ({
      documentId: DOC_ID,
      storageKey: STORAGE_KEY,
      mimeType: 'application/pdf',
      fileSizeBytesMax: null,
      purpose: 'PORTAL_COMPLIANCE_UPLOAD',
    })),
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: mockPrisma,
  prismaRaw: mockPrisma,
  tenantStore: {
    run: (_c: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(() => ({ region: 'EU' })),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
  getRegionalClient: vi.fn(() => mockPrisma),
}));

// Classification routers register only when `module.classification-engine` is
// enabled at module load — force-enable both the build-time bag (root.ts) and
// the per-request evaluator (classificationProcedure) so the reassessment
// router is reachable.
vi.mock('@contractor-ops/feature-flags', async importOriginal => {
  const actual = await importOriginal<typeof import('@contractor-ops/feature-flags')>();
  const bag = {
    values: { 'module.classification-engine': true },
    isEnabled: (key: string) => key === 'module.classification-engine',
  };
  return {
    ...actual,
    buildFlagBag: vi.fn(() => bag),
    lazyFlagBag: vi.fn(() => bag),
    evaluate: vi.fn((key: string) =>
      key === 'module.classification-engine'
        ? { enabled: true, reason: 'mocked' }
        : { enabled: false, reason: 'mocked' },
    ),
  };
});

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: { getSession: vi.fn(), hasPermission: vi.fn().mockResolvedValue({ success: true }) },
  },
  authApi: {
    hasPermission: vi.fn().mockResolvedValue({ success: true }),
    updateOrganization: vi.fn(async () => ({ id: ORG_ID, name: 'Updated Org' })),
    getFullOrganization: vi.fn(async () => ({ id: ORG_ID, name: 'Org', members: [] })),
  },
}));

vi.mock('../services/audit-writer', () => ({ writeAuditLog: auditWriteSpy }));

vi.mock('../services/billing-service', () => ({
  getSubscription: getSubscriptionMock,
  syncSeatCountForOrg: vi.fn(async () => undefined),
}));

vi.mock('../services/portal-session', () => ({
  validatePortalSession: (token: string) => validatePortalSessionMock(token),
}));

vi.mock('../services/pending-upload', () => ({
  createPendingUpload: vi.fn(),
  consumePendingUpload: consumePendingUploadMock,
}));

vi.mock('../services/api-key-service', () => ({
  generateApiKey: vi.fn(() => ({
    plaintext: 'cops_live_secret',
    prefix: 'cops_live_abcd',
    hash: 'h',
  })),
}));

vi.mock('../services/cache', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: { settingsPrefix: (id: string) => `settings:${id}` },
  CacheTTL: { ORG_SETTINGS: 300 },
}));

vi.mock('../services/compliance-payment-gate', () => ({
  assertContractorPaymentEligibility: vi.fn(async () => ({
    blocked: false,
    contractorReasons: [],
  })),
  getDocumentTypeLabelKey: vi.fn(() => 'label'),
}));

vi.mock('../services/payment-export-compliance-snapshot', () => ({
  buildSnapshotForContractor: vi.fn(async () => ({
    snapshotJson: { items: [], eligibilityVerdict: 'PASS' },
    policyRuleSetVersion: 'v1',
    eligibilityVerdict: 'PASS',
    failureReasons: [],
  })),
}));

// Keep VALID_TRANSITIONS real; stub the file/bank helpers so lockAndExport's
// post-transition export step has no I/O dependency.
vi.mock('../routers/finance/payment-shared', async importOriginal => {
  const actual = await importOriginal<typeof import('../routers/finance/payment-shared')>();
  return {
    ...actual,
    _resolveOrgBankInfo: vi.fn(async () => ({
      orgBank: { iban: 'PL00', bic: 'BREXPLPW' },
      transferTitleTemplate: '{invoice_number}',
    })),
    _buildExportItems: vi.fn(() => ({ items: [], settlements: [] })),
    _generateExportFileForFormat: vi.fn(async () => ({
      fileBuffer: Buffer.from('file'),
      ext: 'csv',
    })),
  };
});

vi.mock('../services/notification-service', () => ({
  dispatch: vi.fn(async () => undefined),
  getOrCreatePreferences: vi.fn(async () => ({})),
}));

vi.mock('../services/calendar-deadline-sync', () => ({
  syncPaymentDueDeadline: vi.fn(async () => undefined),
  syncApprovalSlaDeadline: vi.fn(async () => undefined),
  syncContractExpiryDeadline: vi.fn(async () => undefined),
}));

vi.mock('../services/bank-account-crypto', () => ({
  encryptBankAccount: vi.fn((v: string) => `enc:${v}`),
}));

vi.mock('../services/portal-change-request', () => ({
  createChangeRequest: vi.fn(async () => ({
    id: 'cr_1',
    status: 'PENDING',
    createdAt: new Date('2026-01-01'),
  })),
  approveChangeRequest: vi.fn(async () => undefined),
  rejectChangeRequest: vi.fn(async () => undefined),
}));

vi.mock('@sentry/node', () => {
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
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
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
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn(), gauge: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { authApi } from '@contractor-ops/auth';
import { createCallerFactory } from '../init';
import { portalAppRouter } from '../portal-root';
import { appRouter } from '../root';

const createStaffCaller = createCallerFactory(appRouter);
const createPortalCaller = createCallerFactory(portalAppRouter);

function staffCaller(role = 'admin') {
  const session = {
    session: {
      id: `session-${USER_ID}`,
      userId: USER_ID,
      activeOrganizationId: ORG_ID,
      expiresAt: new Date('2099-01-01'),
      token: 'mock-token',
      // Fresh session — passes the sensitiveActionMiddleware re-auth window.
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: USER_ID,
      name: 'Admin Jane',
      email: `${USER_ID}@example.com`,
      emailVerified: true,
      image: null,
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
  return createStaffCaller({
    headers: new Headers(),
    session: session as never,
    user: session.user as never,
  });
}

function portalCaller() {
  const headers = new Headers();
  headers.set('cookie', 'portal_session=mock-token');
  return createPortalCaller({ headers } as never);
}

/** Most-recent audit-writer call payload. */
function lastAudit() {
  return auditWriteSpy.mock.calls.at(-1)?.[0] as
    | {
        action?: string;
        resourceType?: string;
        actorType?: string;
        organizationId?: string;
        tx?: unknown;
      }
    | undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authApi.hasPermission).mockResolvedValue({ success: true } as never);
  getSubscriptionMock.mockResolvedValue({ tier: 'ENTERPRISE', status: 'ACTIVE' } as never);
  validatePortalSessionMock.mockResolvedValue({
    contractorId: CONTRACTOR_ID,
    organizationId: ORG_ID,
    email: 'c@example.com',
    contractor: { id: CONTRACTOR_ID, displayName: 'Test Contractor', email: 'c@example.com' },
  });
  mockPrisma.organization.findUnique.mockResolvedValue({
    dataRegion: 'EU',
    status: 'ACTIVE',
  } as never);
});

// ===========================================================================
// 1. user — member deactivate / reactivate
// ===========================================================================

describe('user.deactivate / user.reactivate — audit row written', () => {
  it('deactivate writes a MEMBER_DEACTIVATE audit row (actorType USER, resourceType USER)', async () => {
    await staffCaller().user.deactivate({ userId: TARGET_USER_ID, reason: 'offboarding' });
    expect(auditWriteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MEMBER_DEACTIVATE',
        resourceType: 'USER',
        actorType: 'USER',
        organizationId: ORG_ID,
        resourceId: TARGET_USER_ID,
      }),
    );
  });

  it('reactivate writes a MEMBER_REACTIVATE audit row', async () => {
    await staffCaller().user.reactivate({ userId: TARGET_USER_ID });
    expect(auditWriteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MEMBER_REACTIVATE',
        resourceType: 'USER',
        actorType: 'USER',
        resourceId: TARGET_USER_ID,
      }),
    );
  });
});

// ===========================================================================
// 2. organization update / delete
// ===========================================================================
//
// CODE NOTE: organizationRouter has NO `update` / `delete` procedures — they
// were removed (organization.ts:16-21) because the web client calls Better
// Auth's `authClient.organization.{create,update}` directly. The org-level
// audited mutation that does exist is `setKleinunternehmer`; `settings.update`
// carries the org-name/legalName/billingEmail changes that "organization
// update" implies and is audited "for the same reasons as organization.update"
// (settings.ts:91-92). Both are asserted here.

describe('organization-level update — audit row written', () => {
  it('organization.setKleinunternehmer writes an ORGANIZATION_KLEINUNTERNEHMER_TOGGLE audit row in-tx', async () => {
    await staffCaller().organization.setKleinunternehmer({ enabled: true });
    const audit = lastAudit();
    expect(audit?.action).toBe('ORGANIZATION_KLEINUNTERNEHMER_TOGGLE');
    expect(audit?.resourceType).toBe('ORGANIZATION');
    expect(audit?.resourceId).toBe(ORG_ID);
    // auditedMutation threads the transaction client.
    expect(audit?.tx).toBeDefined();
  });

  it('there is no organization.update / organization.delete procedure (audited via settings.update / Better Auth)', () => {
    const procedures = (appRouter as unknown as { _def: { procedures: Record<string, unknown> } })
      ._def.procedures;
    const orgKeys = Object.keys(procedures).filter(k => k.startsWith('organization.'));
    expect(orgKeys.length).toBeGreaterThan(0);
    expect(procedures).not.toHaveProperty('organization.update');
    expect(procedures).not.toHaveProperty('organization.delete');
  });
});

// ===========================================================================
// 3. settings.update
// ===========================================================================

describe('settings.update — audit row written', () => {
  it('writes a SETTINGS_UPDATE audit row (resourceType ORGANIZATION)', async () => {
    await staffCaller().settings.update({ name: 'New Co Name', legalName: 'New Co Legal' });
    const audit = lastAudit();
    expect(audit?.action).toBe('SETTINGS_UPDATE');
    expect(audit?.resourceType).toBe('ORGANIZATION');
    expect(audit?.resourceId).toBe(ORG_ID);
    expect(audit?.actorType).toBe('USER');
  });
});

// ===========================================================================
// 4. payment — run export + lock (lockAndExport)
// ===========================================================================

describe('payment.lockAndExport — audit row written in-tx', () => {
  it('writes a payment_run.lock_and_export audit row with tx (resourceType PAYMENT_RUN)', async () => {
    await staffCaller().payment.lockAndExport({ runId: RUN_ID, exportFormat: 'CSV' });
    const audit = lastAudit();
    expect(audit?.action).toBe('payment_run.lock_and_export');
    expect(audit?.resourceType).toBe('PAYMENT_RUN');
    expect(audit?.resourceId).toBe(RUN_ID);
    expect(audit?.actorType).toBe('USER');
    // Export rows + audit commit atomically with the DRAFT→EXPORTED transition.
    expect(audit?.tx).toBeDefined();
  });
});

// ===========================================================================
// 5. apiKey — create + revoke
// ===========================================================================

describe('apiKey.create / apiKey.revoke — audit row written', () => {
  it('create writes an API_KEY_CREATE audit row (resourceType ORGANIZATION)', async () => {
    await staffCaller().apiKey.create({ name: 'CI key', scopes: ['contractor:read'] });
    expect(auditWriteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'API_KEY_CREATE',
        resourceType: 'ORGANIZATION',
        actorType: 'USER',
        organizationId: ORG_ID,
      }),
    );
  });

  it('revoke writes an API_KEY_REVOKE audit row', async () => {
    await staffCaller().apiKey.revoke({ id: API_KEY_ID });
    expect(auditWriteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'API_KEY_REVOKE',
        resourceType: 'ORGANIZATION',
        actorType: 'USER',
      }),
    );
  });
});

// ===========================================================================
// 6. approval decisions — same-transaction audit
// ===========================================================================
//
// CODE NOTE: the primary approve / reject path (approval-queue.ts) records an
// `ApprovalDecision` row inside the tx AND now writes a same-tx `AuditLog`
// through the shared writer (approval.approve / approval.reject); the approval
// *decision trail* is still rebuilt from the decision rows (getAuditTrail).
// `approval.resumeFromCompliance` likewise writes a same-tx AuditLog. All three
// are asserted here.

describe('approval.resumeFromCompliance — same-tx audit row', () => {
  it('writes an approval.compliance_resolved audit row with tx threaded', async () => {
    await staffCaller().approval.resumeFromCompliance({
      approvalFlowId: FLOW_ID,
      reason: 'compliance cleared',
    });
    const audit = lastAudit();
    expect(audit?.action).toBe('approval.compliance_resolved');
    expect(audit?.actorType).toBe('USER');
    expect(audit?.resourceType).toBe('INVOICE');
    expect(audit?.tx).toBeDefined();
  });

  it('approve writes an approval.approve audit row with tx (resourceType INVOICE)', async () => {
    mockPrisma.approvalStep.findFirst = vi.fn(async () => ({
      id: 'step_1',
      organizationId: ORG_ID,
      status: 'PENDING',
      approverUserId: USER_ID,
      approvalFlowId: FLOW_ID,
      approvalFlow: { id: FLOW_ID, resourceId: 'inv_1', resourceType: 'INVOICE' },
    }));
    mockPrisma.approvalDecision = { create: vi.fn(async () => ({})) };
    mockPrisma.approvalStep.updateMany = vi.fn(async () => ({ count: 1 }));
    mockPrisma.approvalStep.findUniqueOrThrow = vi.fn(async () => ({
      id: 'step_1',
      status: 'APPROVED',
    }));
    mockPrisma.approvalFlow.findUnique = vi.fn(async () => ({
      id: FLOW_ID,
      createdByUserId: USER_ID,
      steps: [],
    }));
    mockPrisma.invoice.findUnique = vi.fn(async () => ({
      id: 'inv_1',
      invoiceNumber: 'INV-1',
      totalMinor: 0,
      currency: 'PLN',
      contractorId: null,
      dueDate: null,
    }));

    try {
      await staffCaller().approval.approve({ stepId: 'step_1' });
    } catch {
      // advanceFlow side effects are not the subject; only the audit path is.
    }
    const audit = lastAudit();
    expect(audit?.action).toBe('approval.approve');
    expect(audit?.actorType).toBe('USER');
    expect(audit?.resourceType).toBe('INVOICE');
    expect(audit?.resourceId).toBe('inv_1');
    expect(audit?.tx).toBeDefined();
  });

  it('reject writes an approval.reject audit row with tx (resourceType INVOICE)', async () => {
    mockPrisma.approvalStep.findFirst = vi.fn(async () => ({
      id: 'step_1',
      organizationId: ORG_ID,
      status: 'PENDING',
      approverUserId: USER_ID,
      approvalFlowId: FLOW_ID,
      approvalFlow: { id: FLOW_ID, resourceId: 'inv_1', resourceType: 'INVOICE' },
    }));
    mockPrisma.approvalDecision = { create: vi.fn(async () => ({})) };
    mockPrisma.approvalStep.updateMany = vi.fn(async () => ({ count: 1 }));
    mockPrisma.approvalStep.findUniqueOrThrow = vi.fn(async () => ({
      id: 'step_1',
      status: 'REJECTED',
    }));
    mockPrisma.approvalFlow.update = vi.fn(async () => ({ id: FLOW_ID, status: 'REJECTED' }));
    mockPrisma.invoice.update = vi.fn(async () => ({ id: 'inv_1', status: 'REJECTED' }));
    mockPrisma.invoice.findUnique = vi.fn(async () => ({
      id: 'inv_1',
      invoiceNumber: 'INV-1',
    }));
    mockPrisma.approvalFlow.findUnique = vi.fn(async () => ({ createdByUserId: USER_ID }));

    try {
      await staffCaller().approval.reject({ stepId: 'step_1', comment: 'missing PO reference' });
    } catch {
      // notification side effects are not the subject; only the audit path is.
    }
    const audit = lastAudit();
    expect(audit?.action).toBe('approval.reject');
    expect(audit?.actorType).toBe('USER');
    expect(audit?.resourceType).toBe('INVOICE');
    expect(audit?.resourceId).toBe('inv_1');
    expect(audit?.tx).toBeDefined();
  });
});

// ===========================================================================
// 7. portal profile update — same-transaction audit
// ===========================================================================
//
// CODE NOTE: both `portal.submitUploadReplacement` (compliance.upload.submitted)
// and `portal.updateContactInfo` (portal.contact.update) write a same-tx
// AuditLog through the shared writer with actorType CONTRACTOR — asserted here.

describe('portal profile — same-tx audit row', () => {
  it('submitUploadReplacement writes a compliance.upload.submitted audit row with tx (actorType CONTRACTOR)', async () => {
    await portalCaller().portal.submitUploadReplacement({
      itemId: ITEM_ID,
      documentId: DOC_ID,
      originalFileName: 'doc.pdf',
      fileSizeBytes: 1024,
    });
    const audit = lastAudit();
    expect(audit?.action).toBe('compliance.upload.submitted');
    expect(audit?.actorType).toBe('CONTRACTOR');
    expect(audit?.resourceType).toBe('CONTRACTOR');
    expect(audit?.tx).toBeDefined();
  });

  it('updateContactInfo writes a portal.contact.update audit row with tx (actorType CONTRACTOR)', async () => {
    await portalCaller().portal.updateContactInfo({ displayName: 'New Name' });
    const audit = lastAudit();
    expect(audit?.action).toBe('portal.contact.update');
    expect(audit?.actorType).toBe('CONTRACTOR');
    expect(audit?.resourceType).toBe('CONTRACTOR');
    expect(audit?.resourceId).toBe(CONTRACTOR_ID);
    expect(audit?.tx).toBeDefined();
  });
});

// ===========================================================================
// 8. equipment return (portal) — same-transaction audit
// ===========================================================================

describe('portal equipment return — same-tx audit row', () => {
  it('requestReturn writes a returnRequest.create audit row with tx (resourceType RETURN_REQUEST)', async () => {
    mockPrisma.returnRequest.findFirst.mockResolvedValueOnce(null as never);
    await portalCaller().portal.requestReturn({
      targetPointId: 'tp_1',
      targetPointName: 'Locker 12',
      targetPointAddress: 'Main St 1',
    });
    const audit = lastAudit();
    expect(audit?.action).toBe('returnRequest.create');
    expect(audit?.actorType).toBe('CONTRACTOR');
    expect(audit?.resourceType).toBe('RETURN_REQUEST');
    expect(audit?.tx).toBeDefined();
  });

  it('cancelReturn writes a returnRequest.cancel audit row with tx', async () => {
    await portalCaller().portal.cancelReturn({ id: RETURN_ID });
    const audit = lastAudit();
    expect(audit?.action).toBe('returnRequest.cancel');
    expect(audit?.actorType).toBe('CONTRACTOR');
    expect(audit?.resourceType).toBe('RETURN_REQUEST');
    expect(audit?.tx).toBeDefined();
  });
});

// ===========================================================================
// 9. reassessment trigger ack / dismiss
// ===========================================================================
//
// CODE NOTE: `reassessmentTrigger.acknowledge` / `dismiss` (reassessment-
// trigger.ts) update the trigger row AND write a same-tx AuditLog through the
// shared writer (reassessment.acknowledge / reassessment.dismiss), keyed to the
// underlying contractor (resourceType CONTRACTOR).

describe('reassessmentTrigger.acknowledge / dismiss — same-tx audit row', () => {
  it('acknowledge writes a reassessment.acknowledge audit row with tx (resourceType CONTRACTOR)', async () => {
    mockPrisma.reassessmentTrigger.findFirst.mockResolvedValueOnce({
      id: TRIGGER_ID,
      organizationId: ORG_ID,
      status: 'OPEN',
      contractorAssignmentId: 'classignmentaaaaaaaaaaaaaa',
      contractorAssignment: { contractorId: CONTRACTOR_ID },
    } as never);
    await staffCaller().reassessmentTrigger.acknowledge({ id: TRIGGER_ID });
    const audit = lastAudit();
    expect(audit?.action).toBe('reassessment.acknowledge');
    expect(audit?.actorType).toBe('USER');
    expect(audit?.resourceType).toBe('CONTRACTOR');
    expect(audit?.resourceId).toBe(CONTRACTOR_ID);
    expect(audit?.tx).toBeDefined();
  });

  it('dismiss writes a reassessment.dismiss audit row with tx (resourceType CONTRACTOR)', async () => {
    mockPrisma.reassessmentTrigger.findFirst.mockResolvedValueOnce({
      id: TRIGGER_ID,
      organizationId: ORG_ID,
      status: 'OPEN',
      contractorAssignmentId: 'classignmentaaaaaaaaaaaaaa',
      contractorAssignment: { contractorId: CONTRACTOR_ID },
    } as never);
    await staffCaller().reassessmentTrigger.dismiss({
      id: TRIGGER_ID,
      reason: 'no longer relevant after review',
    });
    const audit = lastAudit();
    expect(audit?.action).toBe('reassessment.dismiss');
    expect(audit?.actorType).toBe('USER');
    expect(audit?.resourceType).toBe('CONTRACTOR');
    expect(audit?.resourceId).toBe(CONTRACTOR_ID);
    expect(audit?.tx).toBeDefined();
  });
});
