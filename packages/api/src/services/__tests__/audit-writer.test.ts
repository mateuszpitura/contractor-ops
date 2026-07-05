// ---------------------------------------------------------------------------
// audit-writer tests.
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockRegionalCreate,
  mockGlobalCreate,
  mockGetRegionalClient,
  mockGetStore,
  mockOrgFindUnique,
} = vi.hoisted(() => {
  const mockRegionalCreate = vi.fn(async () => ({ id: 'aud_regional' }));
  const mockGlobalCreate = vi.fn(async () => ({ id: 'aud_global' }));
  const getStore: () => { organizationId: string; region: string } | undefined = () => ({
    organizationId: 'org_1',
    region: 'EU',
  });
  const findUnique: () => Promise<{ dataRegion: string } | null> = async () => ({
    dataRegion: 'EU',
  });
  return {
    mockRegionalCreate,
    mockGlobalCreate,
    mockGetRegionalClient: vi.fn((_region: string) => ({
      auditLog: { create: mockRegionalCreate, createMany: vi.fn(async () => ({ count: 0 })) },
    })),
    mockGetStore: vi.fn(getStore),
    mockOrgFindUnique: vi.fn(findUnique),
  };
});

vi.mock('@contractor-ops/db', () => {
  const MockDbPrisma = {
    auditLog: { create: mockGlobalCreate },
    organization: { findUnique: mockOrgFindUnique },
  };
  return {
    withRlsTransactions: <T>(c: T) => c,
    withRlsReads: <T>(c: T) => c,
    prisma: MockDbPrisma,
    prismaRaw: MockDbPrisma,
    getRegionalClient: mockGetRegionalClient,
    tenantStore: { getStore: mockGetStore },
  };
});

vi.mock('@contractor-ops/logger', () => ({
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
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
  createLogger: vi.fn(() => ({
    info: vi.fn(),

    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

import { writeAuditLog } from '../audit-writer';

describe('writeAuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-arm defaults so per-test return-value overrides never leak forward
    // (clearAllMocks resets call history, not mockReturnValue/mockResolvedValue).
    mockGetStore.mockReturnValue({ organizationId: 'org_1', region: 'EU' });
    mockOrgFindUnique.mockResolvedValue({ dataRegion: 'EU' });
    mockRegionalCreate.mockResolvedValue({ id: 'aud_regional' });
    mockGlobalCreate.mockResolvedValue({ id: 'aud_global' });
  });

  it('creates exactly one AuditLog row with the supplied fields (happy path)', async () => {
    await writeAuditLog({
      organizationId: 'org_1',
      actorType: 'USER',
      actorId: 'user_1',
      action: 'UPDATE',
      resourceType: 'CONTRACTOR',
      resourceId: 'asg_123',
      oldValues: { activeTo: '2026-01-01' },
      newValues: { activeTo: '2027-01-01' },
    });

    expect(mockRegionalCreate).toHaveBeenCalledTimes(1);
    expect(mockGlobalCreate).not.toHaveBeenCalled();
    const args = mockRegionalCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(args.data.organizationId).toBe('org_1');
    expect(args.data.actorType).toBe('USER');
    expect(args.data.resourceType).toBe('CONTRACTOR');
    expect(args.data.resourceId).toBe('asg_123');
    expect(args.data.oldValuesJson).toEqual({ activeTo: '2026-01-01' });
    expect(args.data.newValuesJson).toEqual({ activeTo: '2027-01-01' });
  });

  it('routes a no-tx write for an ME org through the ME regional client, not the global DB', async () => {
    mockGetStore.mockReturnValue({ organizationId: 'org_me', region: 'ME' });

    await writeAuditLog({
      organizationId: 'org_me',
      actorType: 'USER',
      actorId: 'user_me',
      action: 'contractor.ssn.reveal',
      resourceType: 'CONTRACTOR',
      resourceId: 'c_me',
    });

    expect(mockGetRegionalClient).toHaveBeenCalledWith('ME');
    expect(mockRegionalCreate).toHaveBeenCalledTimes(1);
    // The audit row must NOT land in the global DATABASE_URL client.
    expect(mockGlobalCreate).not.toHaveBeenCalled();
    // Region came from tenant context — no directory round-trip needed.
    expect(mockOrgFindUnique).not.toHaveBeenCalled();
  });

  it('resolves region from the global Organization directory when no tenant context is set', async () => {
    mockGetStore.mockReturnValue(undefined);
    mockOrgFindUnique.mockResolvedValue({ dataRegion: 'ME' });

    await writeAuditLog({
      organizationId: 'org_ctxfree',
      actorType: 'SYSTEM',
      action: 'classification.determinationLetter.generate',
      resourceType: 'DOCUMENT',
      resourceId: 'doc_1',
    });

    expect(mockOrgFindUnique).toHaveBeenCalledWith({
      where: { id: 'org_ctxfree' },
      select: { dataRegion: true },
    });
    expect(mockGetRegionalClient).toHaveBeenCalledWith('ME');
    expect(mockRegionalCreate).toHaveBeenCalledTimes(1);
    expect(mockGlobalCreate).not.toHaveBeenCalled();
  });

  it('refuses the silent global fallback when no region can be resolved', async () => {
    mockGetStore.mockReturnValue(undefined);
    mockOrgFindUnique.mockResolvedValue(null);

    await expect(
      writeAuditLog({
        organizationId: 'org_unknown',
        actorType: 'SYSTEM',
        action: 'UPDATE',
        resourceType: 'CONTRACTOR',
        resourceId: 'c_1',
      }),
    ).rejects.toThrow(/refusing to write the audit row to the global database/);

    expect(mockRegionalCreate).not.toHaveBeenCalled();
    expect(mockGlobalCreate).not.toHaveBeenCalled();
  });

  it('accepts a transaction client via `tx`', async () => {
    const txCreate = vi.fn(async () => ({ id: 'aud_tx' }));
    const tx = { auditLog: { create: txCreate } };

    await writeAuditLog({
      organizationId: 'org_1',
      actorType: 'SYSTEM',
      action: 'CREATE',
      resourceType: 'CONTRACT',
      resourceId: 'con_abc',
      newValues: { status: 'DRAFT' },
      tx,
    });

    expect(txCreate).toHaveBeenCalledTimes(1);
    // Neither the regional client nor the global prisma may be touched when tx is supplied.
    expect(mockRegionalCreate).not.toHaveBeenCalled();
    expect(mockGlobalCreate).not.toHaveBeenCalled();
    expect(mockGetRegionalClient).not.toHaveBeenCalled();
  });

  it('rejects calls missing organizationId', async () => {
    await expect(
      writeAuditLog({
        organizationId: '',
        actorType: 'USER',
        action: 'UPDATE',
        resourceType: 'CONTRACTOR',
        resourceId: 'asg_123',
      }),
    ).rejects.toThrow(/organizationId/);
  });

  it('rejects calls missing resourceId', async () => {
    await expect(
      writeAuditLog({
        organizationId: 'org_1',
        actorType: 'USER',
        action: 'UPDATE',
        resourceType: 'CONTRACTOR',
        resourceId: '',
      }),
    ).rejects.toThrow(/resourceId/);
  });

  it('propagates downstream errors so the enclosing transaction rolls back', async () => {
    mockRegionalCreate.mockRejectedValueOnce(new Error('db down'));
    await expect(
      writeAuditLog({
        organizationId: 'org_1',
        actorType: 'USER',
        action: 'DELETE',
        resourceType: 'CONTRACTOR',
        resourceId: 'asg_1',
      }),
    ).rejects.toThrow(/db down/);
  });
});
