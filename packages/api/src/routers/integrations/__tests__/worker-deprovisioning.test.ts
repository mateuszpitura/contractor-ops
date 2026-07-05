// Worker-keyed IdP deprovisioning trigger — Wave-0 RED scaffold (EMP-OFF-02).
//
// Pins the contract Plan 04 turns GREEN: `startDeprovisioningRun` accepts an
// `{ subjectType: 'EMPLOYEE', workerId }` subject, reads the dated termination
// signal from `EmployeeProfile.terminatedAt` (+ countryCode + Worker.email),
// reuses the pure `canStartDeprovisioning` cooldown gate, blocks pre-cooldown
// with FORBIDDEN, and on allow writes a `DeprovisioningRun{ workerId,
// contractorId: null, assignmentId: null }`. `COUNTRY_TZ` gains a US entry.
//
// Terminal-RED today: the input schema still mandates `assignmentId` (no
// `subjectType`/`workerId`), the worker branch does not exist, and `COUNTRY_TZ`
// is neither exported nor carries US — so the employee calls reject via Zod and
// the run is never created. That is the expected Wave-0 state.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// COUNTRY_TZ is not exported yet — this import resolves to `undefined` until
// Plan 04 exports it and adds the US entry (asserted below).
import { COUNTRY_TZ } from '../deprovisioning';

const ORG_A = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'cluseraaaaaaaaaaaaaaaaaaaaa';
const WORKER_ID = 'clworkeraaaaaaaaaaaaaaaaaaa';

const { mockPrisma, empProfile, runCreates } = vi.hoisted(() => {
  const empProfile = {
    value: {
      countryCode: 'PL',
      terminatedAt: null as Date | null,
      worker: { email: 'jan@example.com' },
    },
  };
  const runCreates: Record<string, unknown>[] = [];
  const mockPrisma = {
    organization: {
      findUnique: vi.fn(async () => ({
        status: 'ACTIVE',
        dataRegion: 'EU',
        settingsJson: { idpDeprovisioningEnabled: { GOOGLE_WORKSPACE: true } },
      })),
    },
    employeeProfile: {
      findFirst: vi.fn(async () => empProfile.value),
    },
    deprovisioningRun: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        runCreates.push(args.data);
        return {
          id: 'clrunaaaaaaaaaaaaaaaaaaaaaa',
          steps: [
            {
              id: 'clstepaaaaaaaaaaaaaaaaaaaa',
              provider: 'GOOGLE_WORKSPACE',
              stepKind: 'SUSPEND_ACCOUNT',
              externalUserId: 'jan@example.com',
            },
          ],
        };
      }),
      update: vi.fn(async () => ({ id: 'clrunaaaaaaaaaaaaaaaaaaaaaa' })),
      findUniqueOrThrow: vi.fn(async () => ({ id: 'clrunaaaaaaaaaaaaaaaaaaaaaa' })),
    },
    $transaction: vi.fn(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)),
  };
  return { mockPrisma, empProfile, runCreates };
});

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
  writeAuditLog: vi.fn(async () => undefined),
}));

vi.mock('@contractor-ops/integrations/services/qstash-client', () => ({
  getQStashClient: vi.fn(() => ({ publishJSON: vi.fn(async () => ({ messageId: 'm1' })) })),
}));

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
      name: 'Test User',
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

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

beforeEach(() => {
  runCreates.length = 0;
  empProfile.value = {
    countryCode: 'PL',
    terminatedAt: null,
    worker: { email: 'jan@example.com' },
  };
  process.env.FLAG_SIGNOFF_BYPASS = 'local';
  vi.clearAllMocks();
});

describe('startDeprovisioningRun — worker subject (EMP-OFF-02)', { timeout: 20000 }, () => {
  it('COUNTRY_TZ carries a US entry mapped to America/New_York', () => {
    expect(COUNTRY_TZ?.US).toBe('America/New_York');
  });

  it('BLOCKS a worker run before the 14-day cooldown elapses (FORBIDDEN/cooldown)', async () => {
    empProfile.value = {
      countryCode: 'PL',
      terminatedAt: daysAgo(1),
      worker: { email: 'jan@example.com' },
    };
    const caller = makeCaller();
    await expect(
      caller.deprovisioning.startDeprovisioningRun({
        subjectType: 'EMPLOYEE',
        workerId: WORKER_ID,
        idempotencyKey: 'idem-worker-0001',
      } as never),
    ).rejects.toThrow(/cooldown/i);
    expect(runCreates).toHaveLength(0);
  });

  it('ALLOWS a worker run after cooldown and writes { workerId, contractorId:null, assignmentId:null }', async () => {
    empProfile.value = {
      countryCode: 'PL',
      terminatedAt: daysAgo(30),
      worker: { email: 'jan@example.com' },
    };
    const caller = makeCaller();
    const result = await caller.deprovisioning.startDeprovisioningRun({
      subjectType: 'EMPLOYEE',
      workerId: WORKER_ID,
      idempotencyKey: 'idem-worker-0002',
    } as never);

    expect(result).toMatchObject({ runId: expect.any(String) });
    expect(runCreates).toHaveLength(1);
    expect(runCreates[0]).toMatchObject({
      workerId: WORKER_ID,
      contractorId: null,
      assignmentId: null,
    });
  });
});
