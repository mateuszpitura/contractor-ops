import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock variables
// ---------------------------------------------------------------------------

const { mockKsefClient, mockTenantDb } = vi.hoisted(() => ({
  mockKsefClient: {
    authenticate: vi.fn(),
    authenticateWithCertificate: vi.fn(),
    queryInvoices: vi.fn(),
    downloadInvoiceXml: vi.fn(),
    terminateSession: vi.fn(),
  },
  mockTenantDb: {
    integrationSyncLog: { create: vi.fn(), update: vi.fn() },
    integrationConnection: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    invoice: { findFirst: vi.fn(), create: vi.fn() },
    member: { findMany: vi.fn() },
    // Raw SQL hooks: tenant scoping (search_path/RLS) + advisory lock acquire.
    $queryRawUnsafe: vi.fn(async () => [{ acquired: true }]),
    $executeRawUnsafe: vi.fn(async () => 0),
  },
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/db', () => {
  const __mockDbPrisma = {
    organization: { findUniqueOrThrow: vi.fn() },
  };
  return {
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: __mockDbPrisma,
  prismaRaw: __mockDbPrisma,
  createTenantClientFrom: vi.fn().mockReturnValue(mockTenantDb),
  getRegionalClient: vi.fn().mockReturnValue('regional-client'),
  tenantStore: {
    run: vi.fn((_ctx: unknown, fn: () => Promise<unknown>) => fn()),
  },

  };
});

vi.mock('@contractor-ops/einvoice', () => {
  const MockKsefApiClient = vi.fn().mockImplementation(function (this: typeof mockKsefClient) {
    Object.assign(this, mockKsefClient);
  });
  return {
    KsefApiClient: MockKsefApiClient,
    ksefConnectionConfigSchema: {
      parse: vi.fn().mockReturnValue({ environment: 'prod', authMethod: 'token' }),
    },
    parseFa3Xml: vi.fn().mockReturnValue({ parsed: true }),
    mapKsefToInvoiceFields: vi.fn().mockReturnValue({
      invoice: {
        invoiceNumber: 'FV/2026/001',
        sellerTaxId: '1234567890',
        totalMinor: 10000,
        currency: 'PLN',
        issueDate: new Date('2026-03-01'),
        dueDate: new Date('2026-03-15'),
        source: 'KSEF',
        externalInvoiceId: 'ref-001',
      },
      lines: [{ description: 'Service', netMinor: 8130, vatMinor: 1870 }],
    }),
  };
});

vi.mock('@contractor-ops/integrations', () => ({
  decryptCredentials: vi.fn().mockReturnValue({ accessToken: 'token' }),
}));

vi.mock('../invoice-matching', () => ({
  computeDuplicateCheckHash: vi.fn().mockReturnValue('hash-123'),
  computeDuplicateCheckHashForInvoice: vi.fn().mockReturnValue('hash-123'),
  runAutoMatch: vi.fn(),
}));

vi.mock('../ksef-duplicate-detection', () => ({
  checkCrossSourceDuplicate: vi.fn().mockResolvedValue({ isDuplicate: false }),
  linkDuplicateInvoices: vi.fn(),
}));

vi.mock('../notification-service', () => ({ dispatch: vi.fn() }));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { prisma } from '@contractor-ops/db';
import { processKsefSync } from '../ksef-sync-orchestrator';
import { dispatch } from '../notification-service';

// ---------------------------------------------------------------------------
// Typed mock handles
// ---------------------------------------------------------------------------

const primaryDb = prisma as unknown as {
  organization: { findUniqueOrThrow: ReturnType<typeof vi.fn> };
};

const mockDispatch = dispatch as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = 'org-1';
const CONN_ID = 'conn-1';

function makeOrg(overrides: Record<string, unknown> = {}) {
  return {
    id: ORG_ID,
    dataRegion: 'EU',
    status: 'ACTIVE',
    settingsJson: { taxId: '1234567890' },
    ...overrides,
  };
}

function makeConnection(overrides: Record<string, unknown> = {}) {
  return {
    id: CONN_ID,
    organizationId: ORG_ID,
    credentialsRef: 'enc-ref',
    configJson: {},
    lastSuccessAt: new Date('2026-03-01'),
    ...overrides,
  };
}

function setupSuccessfulSync(
  opts: {
    connection?: Record<string, unknown>;
    invoiceRefs?: string[];
    alreadyExists?: boolean;
    org?: Record<string, unknown>;
  } = {},
) {
  primaryDb.organization.findUniqueOrThrow.mockResolvedValue(makeOrg(opts.org));
  mockKsefClient.authenticate.mockResolvedValue(undefined);
  mockKsefClient.authenticateWithCertificate.mockResolvedValue(undefined);
  mockTenantDb.integrationSyncLog.create.mockResolvedValue({ id: 'log-1' });
  mockTenantDb.integrationConnection.findUniqueOrThrow.mockResolvedValue(
    makeConnection(opts.connection),
  );
  const refs = opts.invoiceRefs ?? ['ref-001'];
  mockKsefClient.queryInvoices.mockResolvedValue({
    invoiceMetadataList: refs.map(r => ({ ksefReferenceNumber: r })),
  });
  mockKsefClient.downloadInvoiceXml.mockResolvedValue('<xml/>');
  mockTenantDb.invoice.findFirst.mockResolvedValue(
    opts.alreadyExists ? { id: 'existing-inv' } : null,
  );
  mockTenantDb.invoice.create.mockResolvedValue({ id: 'inv-1' });
  mockTenantDb.integrationConnection.update.mockResolvedValue({});
  mockTenantDb.integrationSyncLog.update.mockResolvedValue({});
  mockTenantDb.member.findMany.mockResolvedValue([{ userId: 'user-1' }]);
  mockDispatch.mockResolvedValue(undefined);
  mockKsefClient.terminateSession.mockResolvedValue(undefined);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('processKsefSync', () => {
  it('full sync cycle: authenticates, queries, processes invoices, updates status', async () => {
    setupSuccessfulSync({ invoiceRefs: ['ref-001', 'ref-002'] });

    const result = await processKsefSync({ organizationId: ORG_ID, connectionId: CONN_ID });

    expect(result.invoicesCreated).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(mockKsefClient.authenticate).toHaveBeenCalledOnce();
    expect(mockKsefClient.queryInvoices).toHaveBeenCalledOnce();
    expect(mockKsefClient.downloadInvoiceXml).toHaveBeenCalledTimes(2);
    // Sync log updated to SUCCESS
    const logUpdate = mockTenantDb.integrationSyncLog.update.mock.calls[0]?.[0];
    expect(logUpdate.data.status).toBe('SUCCESS');
    // Connection updated with lastSuccessAt
    const connUpdate = mockTenantDb.integrationConnection.update.mock.calls[0]?.[0];
    expect(connUpdate.data.status).toBe('CONNECTED');
  });

  it('handles authentication failure gracefully', async () => {
    setupSuccessfulSync();
    mockKsefClient.authenticate.mockRejectedValue(new Error('Invalid token'));

    await expect(
      processKsefSync({ organizationId: ORG_ID, connectionId: CONN_ID }),
    ).rejects.toThrow('Invalid token');

    // Sync log marked FAILED
    const logUpdate = mockTenantDb.integrationSyncLog.update.mock.calls[0]?.[0];
    expect(logUpdate.data.status).toBe('FAILED');
    expect(logUpdate.data.errorMessage).toBe('Invalid token');
    // Connection set to ERROR
    const connUpdate = mockTenantDb.integrationConnection.update.mock.calls[0]?.[0];
    expect(connUpdate.data.status).toBe('ERROR');
  });

  it('processes single invoice: download, parse, create, deduplicate, auto-match', async () => {
    setupSuccessfulSync({ invoiceRefs: ['KSEF-REF-001'] });

    await processKsefSync({ organizationId: ORG_ID, connectionId: CONN_ID });

    expect(mockKsefClient.downloadInvoiceXml).toHaveBeenCalledWith('KSEF-REF-001');
    expect(mockTenantDb.invoice.create).toHaveBeenCalledOnce();
    const createArg = mockTenantDb.invoice.create.mock.calls[0]?.[0];
    expect(createArg.data.organizationId).toBe(ORG_ID);
    expect(createArg.data.status).toBe('RECEIVED');
    expect(createArg.data.duplicateCheckHash).toBe('hash-123');
  });

  it('handles empty invoice list (nothing to sync)', async () => {
    setupSuccessfulSync({ invoiceRefs: [] });

    const result = await processKsefSync({ organizationId: ORG_ID, connectionId: CONN_ID });

    expect(result.invoicesCreated).toBe(0);
    expect(result.duplicatesFound).toBe(0);
    expect(mockKsefClient.downloadInvoiceXml).not.toHaveBeenCalled();
    expect(mockTenantDb.invoice.create).not.toHaveBeenCalled();
    // Notification should not dispatch when zero invoices
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('always terminates KSeF session in finally block', async () => {
    setupSuccessfulSync();
    mockKsefClient.queryInvoices.mockRejectedValue(new Error('KSeF API unavailable'));

    await expect(
      processKsefSync({ organizationId: ORG_ID, connectionId: CONN_ID }),
    ).rejects.toThrow('KSeF API unavailable');

    expect(mockKsefClient.terminateSession).toHaveBeenCalledOnce();
  });

  it('updates sync log on success', async () => {
    setupSuccessfulSync({ invoiceRefs: ['ref-001'] });

    await processKsefSync({ organizationId: ORG_ID, connectionId: CONN_ID });

    const logUpdate = mockTenantDb.integrationSyncLog.update.mock.calls[0]?.[0];
    expect(logUpdate.data.status).toBe('SUCCESS');
    expect(logUpdate.data.completedAt).toBeInstanceOf(Date);
    expect(logUpdate.data.responsePayloadJson).toEqual(
      expect.objectContaining({ invoicesCreated: 1 }),
    );
  });

  it('updates sync log on failure', async () => {
    setupSuccessfulSync();
    mockKsefClient.authenticate.mockRejectedValue(new Error('auth failed'));

    await expect(
      processKsefSync({ organizationId: ORG_ID, connectionId: CONN_ID }),
    ).rejects.toThrow();

    const logUpdate = mockTenantDb.integrationSyncLog.update.mock.calls[0]?.[0];
    expect(logUpdate.data.status).toBe('FAILED');
    expect(logUpdate.data.errorMessage).toBe('auth failed');
  });

  it('skips already-fetched invoices', async () => {
    setupSuccessfulSync({ invoiceRefs: ['ref-001'], alreadyExists: true });

    const result = await processKsefSync({ organizationId: ORG_ID, connectionId: CONN_ID });

    expect(result.invoicesCreated).toBe(0);
    expect(mockTenantDb.invoice.create).not.toHaveBeenCalled();
  });

  it('dispatches notification when invoices are created', async () => {
    setupSuccessfulSync({ invoiceRefs: ['ref-001', 'ref-002'] });

    await processKsefSync({ organizationId: ORG_ID, connectionId: CONN_ID });

    expect(mockDispatch).toHaveBeenCalledOnce();
    const dispatchArg = mockDispatch.mock.calls[0]?.[0];
    expect(dispatchArg.type).toBe('KSEF_SYNC_COMPLETE');
    expect(dispatchArg.recipientUserIds).toEqual(['user-1']);
  });
});
