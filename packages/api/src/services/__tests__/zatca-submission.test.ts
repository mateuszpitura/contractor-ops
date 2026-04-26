import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    invoice: {
      findUniqueOrThrow: vi.fn(),
    },
    integrationConnection: {
      findFirst: vi.fn(),
    },
    zatcaInvoiceChain: {
      update: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock('@contractor-ops/db', () => ({
  prisma: mockPrisma,
}));

const { apiClientBehavior, MockZatcaApiError } = vi.hoisted(() => {
  const MockZatcaApiError = class ZatcaApiError extends Error {
    statusCode: number;
    errorType: string;
    constructor(msg: string, code: number, type: string) {
      super(msg);
      this.statusCode = code;
      this.errorType = type;
    }
  };
  /** Mutable per-test behavior for ZatcaApiClient instances */
  const apiClientBehavior = {
    submitForClearance: vi
      .fn()
      .mockResolvedValue({ clearanceStatus: 'CLEARED', validationResults: {} }),
    submitForReporting: vi
      .fn()
      .mockResolvedValue({ reportingStatus: 'REPORTED', validationResults: {} }),
    constructorArgs: null as Record<string, unknown> | null,
  };
  return { apiClientBehavior, MockZatcaApiError };
});

vi.mock('@contractor-ops/einvoice', () => ({
  ZatcaApiClient: class MockZatcaApiClient {
    submitForClearance: typeof apiClientBehavior.submitForClearance;
    submitForReporting: typeof apiClientBehavior.submitForReporting;
    constructor(opts: Record<string, unknown>) {
      apiClientBehavior.constructorArgs = opts;
      this.submitForClearance = apiClientBehavior.submitForClearance;
      this.submitForReporting = apiClientBehavior.submitForReporting;
    }
  },
  ZatcaApiError: MockZatcaApiError,
  ZatcaProfile: class MockZatcaProfile {
    generate = vi.fn().mockResolvedValue('<Invoice/>');
    sign = { sign: vi.fn().mockResolvedValue('<SignedInvoice/>') };
    qrCode = { generateQR: vi.fn().mockResolvedValue(Buffer.from('qr-data')) };
  },
  ZATCA_SANDBOX_URL: 'https://sandbox.zatca.test',
  ZATCA_PRODUCTION_URL: 'https://prod.zatca.test',
}));

const { mockSecretStore } = vi.hoisted(() => {
  const mockSecretStore = {
    get: vi.fn().mockResolvedValue('mock-secret'),
    set: vi.fn(),
    delete: vi.fn(),
  };
  return { mockSecretStore };
});

vi.mock('@contractor-ops/integrations', () => ({
  createZatcaSecretStore: vi.fn().mockReturnValue(mockSecretStore),
  ZATCA_SECRET_NAMES: {
    X509_CERTIFICATE: 'X509_CERTIFICATE',
    PRIVATE_KEY: 'PRIVATE_KEY',
    API_SECRET: 'API_SECRET',
    COMPLIANCE_REQUEST_ID: 'COMPLIANCE_REQUEST_ID',
  },
}));

const { mockQStashPublishJSON } = vi.hoisted(() => ({
  mockQStashPublishJSON: vi.fn().mockResolvedValue({}),
}));

vi.mock('@contractor-ops/integrations/services/qstash-client', () => ({
  getQStashClient: vi.fn().mockReturnValue({
    publishJSON: mockQStashPublishJSON,
  }),
}));

vi.mock('@contractor-ops/validators', () => ({
  getServerEnv: vi.fn().mockReturnValue({
    NEXT_PUBLIC_APP_URL: 'https://app.test',
  }),
}));

vi.mock('../zatca-hash-chain.js', () => ({
  acquireChainLock: vi.fn().mockResolvedValue(undefined),
  getNextChainEntry: vi.fn().mockResolvedValue({ icv: 1, pih: 'genesis-hash' }),
  recordChainEntry: vi.fn().mockResolvedValue({ id: 'chain_1' }),
}));

import {
  handleZatcaSubmissionJob,
  queueZatcaSubmission,
  submitToZatca,
} from '../zatca-submission.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv_1',
    invoiceNumber: 'INV-001',
    issueDate: new Date('2026-01-15'),
    dueDate: new Date('2026-02-15'),
    currency: 'SAR',
    sellerTaxId: '300000000000003',
    sellerName: 'Test Seller',
    buyerTaxId: '300000000000004',
    subtotalMinor: 10000,
    totalMinor: 11500,
    amountToPayMinor: 11500,
    vatRate: '15.00',
    vatAmountMinor: 1500,
    metadata: { zatcaSubtype: '0100000' },
    metadataJson: null,
    lines: [
      {
        description: 'Service',
        quantity: 1,
        unitPriceMinor: 10000,
        netAmountMinor: 10000,
        vatAmountMinor: 1500,
        grossAmountMinor: 11500,
      },
    ],
    contractor: { name: 'Test Buyer' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: submitToZatca
// ---------------------------------------------------------------------------

/** Restore default mock return values after clearAllMocks resets them. */
function restoreDefaults() {
  mockSecretStore.get.mockResolvedValue('mock-secret');
  mockPrisma.zatcaInvoiceChain.update.mockResolvedValue({});
  mockQStashPublishJSON.mockResolvedValue({});
  apiClientBehavior.submitForClearance.mockResolvedValue({
    clearanceStatus: 'CLEARED',
    validationResults: {},
  });
  apiClientBehavior.submitForReporting.mockResolvedValue({
    reportingStatus: 'REPORTED',
    validationResults: {},
  });
  apiClientBehavior.constructorArgs = null;
}

describe('submitToZatca', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restoreDefaults();
  });

  it('throws when no ZATCA connection exists', async () => {
    mockPrisma.invoice.findUniqueOrThrow.mockResolvedValue(baseInvoice());
    mockPrisma.integrationConnection.findFirst.mockResolvedValue(null);

    await expect(submitToZatca({ invoiceId: 'inv_1', organizationId: 'org_1' })).rejects.toThrow(
      'No active ZATCA connection',
    );
  });

  it('throws when certificates are missing', async () => {
    mockPrisma.invoice.findUniqueOrThrow.mockResolvedValue(baseInvoice());
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      configJson: { environment: 'test' },
    });
    mockSecretStore.get.mockResolvedValue(null);

    await expect(submitToZatca({ invoiceId: 'inv_1', organizationId: 'org_1' })).rejects.toThrow(
      'ZATCA certificates not found',
    );
  });

  it('throws when private key is missing', async () => {
    mockPrisma.invoice.findUniqueOrThrow.mockResolvedValue(baseInvoice());
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      configJson: { environment: 'test' },
    });
    // certificate and apiSecret present, privateKey missing
    mockSecretStore.get
      .mockResolvedValueOnce('cert-value')
      .mockResolvedValueOnce('secret-value')
      .mockResolvedValueOnce(null);

    await expect(submitToZatca({ invoiceId: 'inv_1', organizationId: 'org_1' })).rejects.toThrow(
      'ZATCA private key not found',
    );
  });

  it('uses sandbox URL for test environment', async () => {
    mockPrisma.invoice.findUniqueOrThrow.mockResolvedValue(baseInvoice());
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      configJson: { environment: 'test' },
    });
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockPrisma);
    });

    await submitToZatca({ invoiceId: 'inv_1', organizationId: 'org_1' });

    expect(apiClientBehavior.constructorArgs).toEqual(
      expect.objectContaining({ baseUrl: 'https://sandbox.zatca.test' }),
    );
  });

  it('uses production URL for prod environment', async () => {
    mockPrisma.invoice.findUniqueOrThrow.mockResolvedValue(baseInvoice());
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      configJson: { environment: 'prod' },
    });
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockPrisma);
    });

    await submitToZatca({ invoiceId: 'inv_1', organizationId: 'org_1' });

    expect(apiClientBehavior.constructorArgs).toEqual(
      expect.objectContaining({ baseUrl: 'https://prod.zatca.test' }),
    );
  });

  it('submits standard invoice (01xx) for clearance', async () => {
    mockPrisma.invoice.findUniqueOrThrow.mockResolvedValue(
      baseInvoice({ metadata: { zatcaSubtype: '0100000' } }),
    );
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      configJson: { environment: 'test' },
    });
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockPrisma);
    });

    await submitToZatca({ invoiceId: 'inv_1', organizationId: 'org_1' });

    expect(apiClientBehavior.submitForClearance).toHaveBeenCalled();
  });

  it('submits simplified invoice (02xx) for reporting', async () => {
    mockPrisma.invoice.findUniqueOrThrow.mockResolvedValue(
      baseInvoice({ metadata: { zatcaSubtype: '0200000' } }),
    );
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      configJson: { environment: 'test' },
    });
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockPrisma);
    });

    await submitToZatca({ invoiceId: 'inv_1', organizationId: 'org_1' });

    expect(apiClientBehavior.submitForReporting).toHaveBeenCalled();
  });

  it('updates chain entry on API error', async () => {
    mockPrisma.invoice.findUniqueOrThrow.mockResolvedValue(baseInvoice());
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      configJson: { environment: 'test' },
    });
    apiClientBehavior.submitForClearance.mockRejectedValue(
      new MockZatcaApiError('Validation failed', 400, 'non-retryable'),
    );
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockPrisma);
    });

    await expect(submitToZatca({ invoiceId: 'inv_1', organizationId: 'org_1' })).rejects.toThrow();

    expect(mockPrisma.zatcaInvoiceChain.update).toHaveBeenCalledWith({
      where: { id: 'chain_1' },
      data: expect.objectContaining({
        zatcaStatus: 'REJECTED',
        rejectionReason: expect.stringContaining('API Error 400'),
      }),
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: handleZatcaSubmissionJob
// ---------------------------------------------------------------------------

describe('handleZatcaSubmissionJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restoreDefaults();
  });

  it('does not rethrow non-retryable ZatcaApiError', async () => {
    mockPrisma.invoice.findUniqueOrThrow.mockResolvedValue(baseInvoice());
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      configJson: { environment: 'test' },
    });
    apiClientBehavior.submitForClearance.mockRejectedValue(
      new MockZatcaApiError('Auth failed', 401, 'auth'),
    );
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockPrisma);
    });

    // Should not throw -- returns 200 to tell QStash not to retry
    await expect(
      handleZatcaSubmissionJob({ invoiceId: 'inv_1', organizationId: 'org_1' }),
    ).resolves.toBeUndefined();
  });

  it('rethrows retryable errors for QStash retry', async () => {
    mockPrisma.invoice.findUniqueOrThrow.mockResolvedValue(baseInvoice());
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      configJson: { environment: 'test' },
    });
    apiClientBehavior.submitForClearance.mockRejectedValue(
      new MockZatcaApiError('Server error', 503, 'retryable'),
    );
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockPrisma);
    });

    await expect(
      handleZatcaSubmissionJob({ invoiceId: 'inv_1', organizationId: 'org_1' }),
    ).rejects.toThrow();
  });

  it('rethrows non-ZatcaApiError errors', async () => {
    mockPrisma.invoice.findUniqueOrThrow.mockRejectedValue(new Error('Invoice not found'));

    await expect(
      handleZatcaSubmissionJob({ invoiceId: 'inv_missing', organizationId: 'org_1' }),
    ).rejects.toThrow('Invoice not found');
  });
});

// ---------------------------------------------------------------------------
// Tests: queueZatcaSubmission
// ---------------------------------------------------------------------------

describe('queueZatcaSubmission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('publishes to QStash with correct URL and payload', async () => {
    await queueZatcaSubmission('inv_1', 'org_1');

    expect(mockQStashPublishJSON).toHaveBeenCalledWith({
      url: 'https://app.test/api/zatca/_submit',
      body: {
        invoiceId: 'inv_1',
        organizationId: 'org_1',
      },
      retries: 3,
      delay: '1s',
    });
  });

  it('propagates QStash errors', async () => {
    mockQStashPublishJSON.mockRejectedValue(new Error('QStash unavailable'));

    await expect(queueZatcaSubmission('inv_1', 'org_1')).rejects.toThrow('QStash unavailable');
  });
});
