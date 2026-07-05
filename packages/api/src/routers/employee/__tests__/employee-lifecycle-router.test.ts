// Behavioral proof for the employee-lifecycle composition seam: jurisdiction ->
// per-market template resolution, flag-off rejection, audit emission
// (resourceType EMPLOYEE), and HR-RBAC gating. The mock prisma drives the real
// startWorkflowRun helper (no duplicate create); statutory-cert-pdf + r2 are
// stubbed so the test never runs react-pdf or touches R2.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_A = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'cluseraaaaaaaaaaaaaaaaaaaaa';
const WORKER_ID = 'clworkeraaaaaaaaaaaaaaaaaaa';

const { mockPrisma, auditWrites, flagState, permState, state } = vi.hoisted(() => {
  const flagState = { value: true };
  const permState = { value: true };
  const auditWrites: Record<string, unknown>[] = [];
  const state = {
    employeeProfile: {
      id: 'clempaaaaaaaaaaaaaaaaaaaaaa',
      countryCode: 'PL',
      terminatedAt: null as Date | null,
      peselLast4: '6789',
      ssnLast4: null as string | null,
      worker: { displayName: 'Jan Kowalski' },
    } as Record<string, unknown> | null,
    template: { id: 'cltmplaaaaaaaaaaaaaaaaaaaaa', tasks: [], type: 'ONBOARDING' } as Record<
      string,
      unknown
    > | null,
  };

  const mockPrisma = {
    organization: {
      findUnique: vi.fn(async () => ({
        status: 'ACTIVE',
        dataRegion: 'EU',
        name: 'Acme Sp. z o.o.',
        settingsJson: {},
      })),
    },
    employeeProfile: {
      findFirst: vi.fn(async () => state.employeeProfile),
      update: vi.fn(async () => ({ terminatedAt: new Date('2026-06-30T00:00:00.000Z') })),
    },
    workflowTemplate: {
      findFirst: vi.fn(async () => state.template),
    },
    worker: {
      findFirst: vi.fn(async () => ({
        id: WORKER_ID,
        organizationId: ORG_A,
        workerType: 'EMPLOYEE',
        displayName: 'Jan Kowalski',
        email: 'jan@example.com',
      })),
    },
    workflowRun: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'clrunaaaaaaaaaaaaaaaaaaaaaa',
        ...data,
      })),
      update: vi.fn(async () => ({
        id: 'clrunaaaaaaaaaaaaaaaaaaaaaa',
        tasks: [],
        workflowTemplate: { name: 'Onboarding PL', type: 'ONBOARDING' },
      })),
      findFirst: vi.fn(async () => ({ id: 'clrunaaaaaaaaaaaaaaaaaaaaaa' })),
    },
    workflowTaskRun: { findMany: vi.fn(async () => []) },
    statutoryCertificate: {
      create: vi.fn(async () => ({ id: 'clcertaaaaaaaaaaaaaaaaaaaaa' })),
    },
    $transaction: vi.fn(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)),
  };

  return { mockPrisma, auditWrites, flagState, permState, state };
});

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: { getSession: vi.fn(), hasPermission: vi.fn(async () => ({ success: permState.value })) },
  },
  authApi: { hasPermission: vi.fn(async () => ({ success: permState.value })) },
}));

vi.mock('@contractor-ops/feature-flags', async importOriginal => {
  const actual = await importOriginal<typeof import('@contractor-ops/feature-flags')>();
  return {
    ...actual,
    evaluate: vi.fn(() => ({ enabled: flagState.value, reason: 'test' })),
  };
});

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

vi.mock('@contractor-ops/logger', () => {
  const noop = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return {
    createWebhookLogger: vi.fn(() => noop),
    withBodyLogging: vi.fn((_o: unknown, fn: unknown) => fn),
    logIntegrationCall: vi.fn(),
    subscribeOpossumEvents: vi.fn(),
    runWithRequestContext: vi.fn((_c: unknown, fn: () => unknown) => fn()),
    getRequestId: vi.fn(() => undefined),
    getTraceparent: vi.fn(() => undefined),
    buildContextFromHeaders: vi.fn(() => ({})),
    getOutboundHeaders: vi.fn(() => ({})),
    generateRequestId: vi.fn(() => 'test-request-id'),
    logger: noop,
    LOG_BODY_INCLUDE_PREFIXES: [],
    PII_MASK_KEYWORDS: [],
    PII_MASK_PATHS: [],
    createIntegrationLogger: vi.fn(() => noop),
    createLogger: vi.fn(() => noop),
    createTrpcLogger: vi.fn(() => noop),
    createCronLogger: vi.fn(() => noop),
    getIdpAuditLogger: vi.fn(() => noop),
  };
});

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), gauge: vi.fn(), distribution: vi.fn() },
}));

vi.mock('../../../services/audit-writer', () => ({
  writeAuditLog: vi.fn(async (input: Record<string, unknown>) => {
    auditWrites.push(input);
  }),
}));

vi.mock('../../../services/statutory-cert-pdf', () => ({
  sanitizeCertSnapshot: <T>(v: T) => v,
  statutoryCertArchiveKey: (orgId: string, id: string) => `emp-cert/${orgId}/${id}.pdf`,
  renderAndArchiveStatutoryCert: vi.fn(async (_db: unknown, certId: string) => ({
    certId,
    pdfArchiveKey: `emp-cert/${ORG_A}/${certId}.pdf`,
    skipped: false,
  })),
}));

vi.mock('../../../services/r2', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../services/r2')>();
  return { ...actual, createPresignedDownloadUrl: vi.fn(async () => 'https://r2/signed') };
});

import { createCallerFactory } from '../../../init';
import { appRouter } from '../../../root';

const createCaller = createCallerFactory(appRouter);

function makeCaller(orgId = ORG_A, userId = USER_ID) {
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
      name: 'HR Admin',
      email: `${userId}@example.com`,
      emailVerified: true,
      image: null,
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

beforeEach(() => {
  auditWrites.length = 0;
  flagState.value = true;
  permState.value = true;
  state.employeeProfile = {
    id: 'clempaaaaaaaaaaaaaaaaaaaaaa',
    countryCode: 'PL',
    terminatedAt: null,
    peselLast4: '6789',
    ssnLast4: null,
    worker: { displayName: 'Jan Kowalski' },
  };
  state.template = { id: 'cltmplaaaaaaaaaaaaaaaaaaaaa', tasks: [], type: 'ONBOARDING' };
  vi.clearAllMocks();
});

describe('employeeLifecycle — composition seam', { timeout: 20000 }, () => {
  it('jurisdiction -> template: PL employee resolves the org PL ONBOARDING template and starts a run', async () => {
    const caller = makeCaller();
    const result = await caller.employeeLifecycle.startOnboarding({ workerId: WORKER_ID });

    expect(result.runId).toBeDefined();
    expect(mockPrisma.workflowTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: ORG_A,
          jurisdiction: 'PL',
          type: 'ONBOARDING',
          appliesToEntityType: 'EMPLOYEE',
          status: 'ACTIVE',
        }),
      }),
    );
  });

  it('throws NOT_FOUND for an unseeded jurisdiction (no active template)', async () => {
    state.template = null;
    const caller = makeCaller();
    await expect(caller.employeeLifecycle.startOnboarding({ workerId: WORKER_ID })).rejects.toThrow(
      /employeeLifecycleTemplateNotFound/,
    );
  });

  it('flag-off: a workforce-disabled org is rejected by assertWorkforceEnabled', async () => {
    flagState.value = false;
    const caller = makeCaller();
    await expect(
      caller.employeeLifecycle.startOffboarding({ workerId: WORKER_ID }),
    ).rejects.toThrow();
  });

  it('HR-RBAC: a caller lacking employee:update is rejected', async () => {
    permState.value = false;
    const caller = makeCaller();
    await expect(
      caller.employeeLifecycle.recordTermination({
        workerId: WORKER_ID,
        terminatedAt: '2026-06-30T00:00:00.000Z',
      }),
    ).rejects.toThrow();
  });

  it('recordTermination writes terminatedAt + audits as resourceType EMPLOYEE', async () => {
    const caller = makeCaller();
    await caller.employeeLifecycle.recordTermination({
      workerId: WORKER_ID,
      terminatedAt: '2026-06-30T00:00:00.000Z',
    });

    expect(mockPrisma.employeeProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ employmentStatus: 'TERMINATED' }),
      }),
    );
    const term = auditWrites.find(a => a.action === 'employee.termination.recorded');
    expect(term?.resourceType).toBe('EMPLOYEE');
  });

  it('generateCert creates a DRAFT cert and audits as resourceType EMPLOYEE', async () => {
    const caller = makeCaller();
    const result = await caller.employeeLifecycle.generateCert({
      workflowRunId: 'clrunaaaaaaaaaaaaaaaaaaaaaa',
      workerId: WORKER_ID,
      certType: 'SWIADECTWO_PRACY',
    });

    expect(result.certId).toBeDefined();
    expect(result.downloadUrl).toBe('https://r2/signed');
    expect(mockPrisma.statutoryCertificate.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'DRAFT' }) }),
    );
    const cert = auditWrites.find(a => a.action === 'employee.cert.generated');
    expect(cert?.resourceType).toBe('EMPLOYEE');
  });
});
