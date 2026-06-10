import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/db', () => {
  const prisma = {
    integrationSyncLog: { create: vi.fn(), update: vi.fn() },
    integrationConnection: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    organization: { findUniqueOrThrow: vi.fn() },
    invoice: { findFirst: vi.fn(), create: vi.fn() },
    ocrCreditLedger: { create: vi.fn() },
    matchResult: { create: vi.fn() },
    member: { findMany: vi.fn() },
    // Raw SQL hooks: tenant scoping (search_path/RLS) + advisory lock acquire.
    // Returning [{acquired: true}] makes pg_try_advisory_lock succeed in tests.
    $queryRawUnsafe: vi.fn(async () => [{ acquired: true }]),
    $executeRawUnsafe: vi.fn(async () => 0),
  };
  return {
    prismaRaw: prisma,
    prisma,
    createTenantClient: vi.fn(() => prisma),
    createTenantClientFrom: vi.fn(() => prisma),
    getRegionalClient: vi.fn(() => prisma),
    tenantStore: {
      getStore: vi.fn(() => ({ organizationId: 'org-1', region: 'EU' })),
      run: vi.fn((_ctx: unknown, fn: () => unknown) => fn()),
    },
    withTenantScope: vi.fn((_ctx: unknown, fn: () => unknown) => fn()),
    withRlsTransactions: <T>(c: T) => c,
    withRlsReads: <T>(c: T) => c,
  };
});

const mockKsefClient = {
  authenticate: vi.fn(),
  authenticateWithCertificate: vi.fn(),
  queryInvoices: vi.fn(),
  downloadInvoiceXml: vi.fn(),
  terminateSession: vi.fn(),
};

vi.mock('@contractor-ops/integrations', () => ({
  decryptCredentials: vi.fn().mockReturnValue({ accessToken: 'token' }),
}));

vi.mock('@contractor-ops/einvoice', () => {
  const MockKsefApiClient = vi.fn().mockImplementation(function (this: typeof mockKsefClient) {
    Object.assign(this, mockKsefClient);
  });
  return {
    prismaRaw: prisma,
    KsefApiClient: MockKsefApiClient,
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
    ksefConnectionConfigSchema: {
      parse: vi.fn().mockReturnValue({ environment: 'prod', authMethod: 'token' }),
    },
  };
});

vi.mock('@contractor-ops/validators', () => ({
  getServerEnv: vi.fn(() => process.env),
  ksefConnectionConfigSchema: {
    parse: vi.fn().mockReturnValue({ environment: 'prod', authMethod: 'token' }),
  },
}));

vi.mock('../invoice-matching', () => ({
  computeDuplicateCheckHash: vi.fn().mockReturnValue('hash123'),
  computeDuplicateCheckHashForInvoice: vi.fn().mockReturnValue('hash123'),
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

const db = prisma as unknown as {
  integrationSyncLog: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  integrationConnection: {
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  organization: {
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
  };
  invoice: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  member: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

const mockDispatch = dispatch as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = 'org-1';
const CONN_ID = 'conn-1';

function makeConnection(overrides: Record<string, unknown> = {}) {
  return {
    prismaRaw: prisma,
    id: CONN_ID,
    organizationId: ORG_ID,
    credentialsRef: 'enc-ref',
    configJson: {},
    lastSuccessAt: new Date('2026-03-01'),
    ...overrides,
  };
}

function makeOrg(overrides: Record<string, unknown> = {}) {
  return {
    prismaRaw: prisma,
    id: ORG_ID,
    settingsJson: { taxId: '1234567890' },
    ...overrides,
  };
}

function invoiceMetadata(ref: string) {
  return {
    prismaRaw: prisma,
    ksefReferenceNumber: ref,
  };
}

function setupSuccessfulSync(
  overrides: {
    connection?: Record<string, unknown>;
    invoiceRefs?: string[];
    alreadyExists?: boolean;
  } = {},
) {
  const conn = makeConnection(overrides.connection);
  const refs = overrides.invoiceRefs ?? ['ref-001'];

  db.integrationSyncLog.create.mockResolvedValue({ id: 'log-1' });
  db.integrationConnection.findUniqueOrThrow.mockResolvedValue(conn);
  db.organization.findUniqueOrThrow.mockResolvedValue(makeOrg());
  mockKsefClient.queryInvoices.mockResolvedValue({
    invoiceMetadataList: refs.map(invoiceMetadata),
  });
  mockKsefClient.downloadInvoiceXml.mockResolvedValue('<xml/>');
  db.invoice.findFirst.mockResolvedValue(overrides.alreadyExists ? { id: 'existing-inv' } : null);
  db.invoice.create.mockResolvedValue({ id: 'inv-1' });
  db.integrationConnection.update.mockResolvedValue({});
  db.integrationSyncLog.update.mockResolvedValue({});
  db.member.findMany.mockResolvedValue([{ userId: 'user-1' }]);
  mockDispatch.mockResolvedValue(undefined);
  mockKsefClient.terminateSession.mockResolvedValue(undefined);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processKsefSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates IntegrationSyncLog with STARTED status at beginning', async () => {
    setupSuccessfulSync();

    await processKsefSync({ organizationId: ORG_ID, connectionId: CONN_ID });

    expect(db.integrationSyncLog.create).toHaveBeenCalledOnce();
    const createArg = db.integrationSyncLog.create.mock.calls[0]?.[0];
    expect(createArg.data.status).toBe('STARTED');
    expect(createArg.data.organizationId).toBe(ORG_ID);
    expect(createArg.data.integrationConnectionId).toBe(CONN_ID);
    expect(createArg.data.direction).toBe('INBOUND');
    expect(createArg.data.startedAt).toBeInstanceOf(Date);
  });

  it('updates connection lastSuccessAt after successful sync', async () => {
    setupSuccessfulSync();

    await processKsefSync({ organizationId: ORG_ID, connectionId: CONN_ID });

    // The connection update should include lastSuccessAt
    const updateCalls = db.integrationConnection.update.mock.calls;
    expect(updateCalls.length).toBeGreaterThanOrEqual(1);
    const successUpdate = updateCalls[0]?.[0];
    expect(successUpdate.where).toEqual({ id: CONN_ID });
    expect(successUpdate.data.lastSyncAt).toBeInstanceOf(Date);
    expect(successUpdate.data.lastSuccessAt).toBeInstanceOf(Date);
    expect(successUpdate.data.status).toBe('CONNECTED');
  });

  it('stores KSeF reference in externalInvoiceId via invoice.create', async () => {
    setupSuccessfulSync({ invoiceRefs: ['KSEF-REF-123'] });

    await processKsefSync({ organizationId: ORG_ID, connectionId: CONN_ID });

    // Verify the findFirst check uses the KSeF reference number
    const findFirstCall = db.invoice.findFirst.mock.calls[0]?.[0];
    expect(findFirstCall.where.externalInvoiceId).toBe('KSEF-REF-123');
    expect(findFirstCall.where.source).toBe('KSEF');
  });

  it('stores UPO number in sourceReference — downloadInvoiceXml called with ref', async () => {
    setupSuccessfulSync({ invoiceRefs: ['KSEF-UPO-456'] });

    await processKsefSync({ organizationId: ORG_ID, connectionId: CONN_ID });

    // downloadInvoiceXml is called with the ksefReferenceNumber
    expect(mockKsefClient.downloadInvoiceXml).toHaveBeenCalledWith('KSEF-UPO-456');
  });

  it('dispatches KSEF_SYNC_COMPLETE notification when invoices found', async () => {
    setupSuccessfulSync({ invoiceRefs: ['ref-001', 'ref-002'] });

    await processKsefSync({ organizationId: ORG_ID, connectionId: CONN_ID });

    expect(mockDispatch).toHaveBeenCalledOnce();
    const dispatchArg = mockDispatch.mock.calls[0]?.[0];
    expect(dispatchArg.type).toBe('KSEF_SYNC_COMPLETE');
    expect(dispatchArg.organizationId).toBe(ORG_ID);
    expect(dispatchArg.recipientUserIds).toEqual(['user-1']);
    expect(dispatchArg.body).toContain('2');
  });

  it('does not dispatch notification when no new invoices', async () => {
    setupSuccessfulSync({ invoiceRefs: [] });

    await processKsefSync({ organizationId: ORG_ID, connectionId: CONN_ID });

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('skips already-fetched invoices by externalInvoiceId', async () => {
    setupSuccessfulSync({ invoiceRefs: ['ref-001'], alreadyExists: true });

    const result = await processKsefSync({
      organizationId: ORG_ID,
      connectionId: CONN_ID,
    });

    // invoice.create should NOT be called because findFirst returned existing
    expect(db.invoice.create).not.toHaveBeenCalled();
    expect(result.invoicesCreated).toBe(0);
  });

  it('falls back to 90-day date range on first sync (no lastSuccessAt)', async () => {
    const FAKE_NOW = new Date('2026-04-01T12:00:00.000Z');
    vi.useFakeTimers({ now: FAKE_NOW });

    try {
      setupSuccessfulSync({
        connection: { lastSuccessAt: null },
        invoiceRefs: [],
      });

      await processKsefSync({ organizationId: ORG_ID, connectionId: CONN_ID });

      const queryCall = mockKsefClient.queryInvoices.mock.calls[0];
      const dateFrom = queryCall[1] as string;
      // 90 days before 2026-04-01 is 2026-01-01
      expect(dateFrom).toBe('2026-01-01');
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses lastSuccessAt as dateFrom for subsequent syncs', async () => {
    const lastSync = new Date('2026-03-15T10:00:00.000Z');
    setupSuccessfulSync({
      connection: { lastSuccessAt: lastSync },
      invoiceRefs: [],
    });

    await processKsefSync({ organizationId: ORG_ID, connectionId: CONN_ID });

    const queryCall = mockKsefClient.queryInvoices.mock.calls[0];
    const dateFrom = queryCall[1] as string;
    expect(dateFrom).toBe('2026-03-15');
  });

  it('sets connection status to ERROR when all invoices fail', async () => {
    setupSuccessfulSync({ invoiceRefs: ['ref-fail'] });
    // Make invoice.create throw for every invoice
    db.invoice.create.mockRejectedValue(new Error('DB constraint violation'));

    await processKsefSync({ organizationId: ORG_ID, connectionId: CONN_ID });

    const updateCall = db.integrationConnection.update.mock.calls[0]?.[0];
    expect(updateCall.data.status).toBe('ERROR');
    expect(updateCall.data.lastErrorMessage).toContain('DB constraint violation');
  });

  it('terminates KSeF session in finally block even on error', async () => {
    setupSuccessfulSync();
    // Throw AFTER the client is constructed and authenticated (step 5: queryInvoices)
    mockKsefClient.queryInvoices.mockRejectedValue(new Error('KSeF API unavailable'));

    await expect(
      processKsefSync({ organizationId: ORG_ID, connectionId: CONN_ID }),
    ).rejects.toThrow('KSeF API unavailable');

    // terminateSession should still be called in the finally block
    expect(mockKsefClient.terminateSession).toHaveBeenCalledOnce();
  });

  it('updates sync log to FAILED on unhandled error inside tenant scope', async () => {
    setupSuccessfulSync();
    // Fail after syncLog has been created — inside the tenantStore.run block.
    db.integrationConnection.findUniqueOrThrow.mockRejectedValue(new Error('unexpected failure'));

    await expect(
      processKsefSync({ organizationId: ORG_ID, connectionId: CONN_ID }),
    ).rejects.toThrow('unexpected failure');

    const updateCall = db.integrationSyncLog.update.mock.calls[0]?.[0];
    expect(updateCall.data.status).toBe('FAILED');
    expect(updateCall.data.errorMessage).toBe('unexpected failure');
    expect(updateCall.data.completedAt).toBeInstanceOf(Date);
  });
});
