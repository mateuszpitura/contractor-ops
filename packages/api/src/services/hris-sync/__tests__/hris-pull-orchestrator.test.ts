import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

const {
  mockPrisma,
  mockTryAcquire,
  mockRelease,
  mockGetAdapter,
  mockLoadHeavy,
  mockDecrypt,
  mockApplyPatch,
} = vi.hoisted(() => ({
  mockPrisma: { $queryRawUnsafe: vi.fn(), $executeRawUnsafe: vi.fn() },
  mockTryAcquire: vi.fn(async () => true),
  mockRelease: vi.fn(async () => undefined),
  mockGetAdapter: vi.fn(),
  mockLoadHeavy: vi.fn(async () => undefined),
  mockDecrypt: vi.fn(() => ({ accessToken: 'tok' })),
  mockApplyPatch: vi.fn(async () => undefined),
}));

vi.mock('@contractor-ops/db', () => ({ prisma: mockPrisma }));
vi.mock('../../../lib/advisory-lock', () => ({
  tryAcquireAdvisoryLock: mockTryAcquire,
  releaseAdvisoryLock: mockRelease,
}));
vi.mock('@contractor-ops/integrations', () => ({
  getAdapter: mockGetAdapter,
  loadHeavyAdapters: mockLoadHeavy,
  decryptCredentials: mockDecrypt,
}));
vi.mock('../apply-patch', () => ({ applyPatchToWorker: mockApplyPatch }));

import { runHrisPull } from '../pull-orchestrator';

const employees = [
  {
    externalId: 'p-1001',
    provider: 'PERSONIO' as const,
    attributes: { name: 'A', status: 'active' },
  },
  {
    externalId: 'p-1002',
    provider: 'PERSONIO' as const,
    attributes: { name: 'B', status: 'active' },
  },
];

function buildDb(connection: Record<string, unknown>) {
  const syncLog = { id: 'sync-1' };
  return {
    calls: {
      syncLogCreate: [] as unknown[],
      syncLogUpdate: [] as unknown[],
      connUpdate: [] as unknown[],
    },
    integrationConnection: {
      findFirst: vi.fn(async () => connection),
      update: vi.fn(async (a: unknown) => {
        this as never; // noop
        return a;
      }),
    },
    integrationSyncLog: {
      create: vi.fn(async () => syncLog),
      update: vi.fn(async () => syncLog),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTryAcquire.mockResolvedValue(true);
  mockGetAdapter.mockReturnValue({ listEmployees: vi.fn(async () => employees) });
});

const baseConnection = {
  id: 'conn-1',
  organizationId: 'org-a',
  provider: 'PERSONIO',
  status: 'CONNECTED',
  credentialsRef: 'enc:ref',
  configJson: { mapping: { standard: { displayName: 'name', employmentStatus: 'status' } } },
};

describe('runHrisPull', () => {
  it('writes an INBOUND sync log STARTED→SUCCESS and applies the allowlist patch per record', async () => {
    const db = buildDb(baseConnection);
    const res = await runHrisPull({
      db: db as never,
      organizationId: 'org-a',
      connectionId: 'conn-1',
      actorUserId: null,
    });

    expect(db.integrationSyncLog.create).toHaveBeenCalledTimes(1);
    const createArg = db.integrationSyncLog.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(createArg.data.direction).toBe('INBOUND');
    expect(createArg.data.syncType).toBe('hris_employee_sync');
    expect(createArg.data.status).toBe('STARTED');
    expect(mockApplyPatch).toHaveBeenCalledTimes(2);
    expect(res.status).toBe('SUCCESS');
  });

  it('takes the sync advisory-lock keyed to the connection and skips a concurrent run', async () => {
    mockTryAcquire.mockResolvedValueOnce(false);
    const db = buildDb(baseConnection);
    const res = await runHrisPull({
      db: db as never,
      organizationId: 'org-a',
      connectionId: 'conn-1',
      actorUserId: null,
    });
    expect(mockTryAcquire).toHaveBeenCalledWith(expect.anything(), 'sync', 'hris:conn-1');
    expect(res.status).toBe('SKIPPED');
    expect(mockApplyPatch).not.toHaveBeenCalled();
  });

  it('is per-record best-effort: one failing record does not abort the run', async () => {
    mockApplyPatch.mockRejectedValueOnce(new Error('bad record'));
    const db = buildDb(baseConnection);
    const res = await runHrisPull({
      db: db as never,
      organizationId: 'org-a',
      connectionId: 'conn-1',
      actorUserId: null,
    });
    expect(res.errors).toBe(1);
    expect(res.applied).toBe(1);
    expect(res.status).toBe('SUCCESS');
  });

  it('releases the advisory lock even after a successful run', async () => {
    const db = buildDb(baseConnection);
    await runHrisPull({
      db: db as never,
      organizationId: 'org-a',
      connectionId: 'conn-1',
      actorUserId: null,
    });
    expect(mockRelease).toHaveBeenCalledWith(expect.anything(), 'sync', 'hris:conn-1');
  });
});
