import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock variables (available inside vi.mock factories)
// ---------------------------------------------------------------------------

const { mockSecretStore, mockZatcaApiClient } = vi.hoisted(() => ({
  mockSecretStore: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
  mockZatcaApiClient: {
    requestComplianceCsid: vi.fn(),
    requestProductionCsid: vi.fn(),
    submitComplianceInvoice: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/db', () => {
  const MockDbPrisma = {
    integrationConnection: {
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  return {
    withRlsTransactions: <T>(c: T) => c,
    withRlsReads: <T>(c: T) => c,
    prisma: MockDbPrisma,
    prismaRaw: MockDbPrisma,
  };
});

vi.mock('@contractor-ops/einvoice', () => {
  class MockZatcaApiClient {
    requestComplianceCsid = mockZatcaApiClient.requestComplianceCsid;
    requestProductionCsid = mockZatcaApiClient.requestProductionCsid;
    submitComplianceInvoice = mockZatcaApiClient.submitComplianceInvoice;
  }
  return {
    generateZatcaCsr: vi.fn().mockReturnValue({
      csr: '-----BEGIN CERTIFICATE REQUEST-----\nMOCK_CSR\n-----END CERTIFICATE REQUEST-----',
      privateKey: 'MOCK_PRIVATE_KEY',
    }),
    generateZatcaXml: vi.fn().mockResolvedValue('<Invoice/>'),
    buildComplianceTestInvoices: vi.fn().mockReturnValue([
      {
        invoiceTypeCode: '388',
        extensions: { invoiceType: 'standard', invoiceSubtype: '0100', uuid: 'uuid-1' },
      },
      {
        invoiceTypeCode: '381',
        extensions: { invoiceType: 'standard', invoiceSubtype: '0100', uuid: 'uuid-2' },
      },
      {
        invoiceTypeCode: '383',
        extensions: { invoiceType: 'standard', invoiceSubtype: '0100', uuid: 'uuid-3' },
      },
      {
        invoiceTypeCode: '388',
        extensions: { invoiceType: 'simplified', invoiceSubtype: '1000', uuid: 'uuid-4' },
      },
      {
        invoiceTypeCode: '381',
        extensions: { invoiceType: 'simplified', invoiceSubtype: '1000', uuid: 'uuid-5' },
      },
      {
        invoiceTypeCode: '383',
        extensions: { invoiceType: 'simplified', invoiceSubtype: '1000', uuid: 'uuid-6' },
      },
    ]),
    zatcaTaxDetailsSchema: {
      parse: vi.fn().mockImplementation((val: unknown) => val),
    },
    ZatcaApiClient: MockZatcaApiClient,
  };
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

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { prisma } from '@contractor-ops/db';
import { zatcaTaxDetailsSchema } from '@contractor-ops/einvoice';
import {
  exchangeProductionCertificate,
  generateAndStoreCsr,
  getOnboardingState,
  requestComplianceCsid,
  runComplianceChecks,
  saveTaxDetails,
} from '../zatca-onboarding';

// ---------------------------------------------------------------------------
// Typed mock handles
// ---------------------------------------------------------------------------

const db = prisma as unknown as {
  integrationConnection: {
    findFirst: ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = 'org-zatca-1';
const USER_ID = 'user-1';

function makeTaxDetails() {
  return {
    vatNumber: '300000000000003',
    orgNameArabic: 'شركة اختبار',
    street: 'King Fahd Road',
    district: 'Al Olaya',
    city: 'Riyadh',
    postalCode: '12345',
    invoiceTypes: ['standard', 'simplified'],
  };
}

function makeConnection(configOverrides: Record<string, unknown> = {}) {
  return {
    id: 'conn-1',
    organizationId: ORG_ID,
    provider: 'ZATCA',
    status: 'DISCONNECTED',
    configJson: {
      environment: 'sandbox',
      currentStep: 'tax_details',
      certificateStatus: 'none',
      ...configOverrides,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('saveTaxDetails', () => {
  it('validates input with zatcaTaxDetailsSchema and updates connection config', async () => {
    const taxDetails = makeTaxDetails();
    const conn = makeConnection();
    db.integrationConnection.findFirst.mockResolvedValue(conn);
    db.integrationConnection.findUniqueOrThrow.mockResolvedValue(conn);
    db.integrationConnection.update.mockResolvedValue(conn);

    await saveTaxDetails(ORG_ID, taxDetails as never, USER_ID);

    expect(zatcaTaxDetailsSchema.parse).toHaveBeenCalledWith(taxDetails);
    expect(db.integrationConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: conn.id },
        data: expect.objectContaining({
          configJson: expect.objectContaining({
            taxDetails: taxDetails,
            currentStep: 'csr_generation',
          }),
        }),
      }),
    );
  });

  it('creates connection when none exists', async () => {
    const taxDetails = makeTaxDetails();
    const newConn = makeConnection();
    db.integrationConnection.findFirst.mockResolvedValue(null);
    db.integrationConnection.create.mockResolvedValue(newConn);
    db.integrationConnection.findUniqueOrThrow.mockResolvedValue(newConn);
    db.integrationConnection.update.mockResolvedValue(newConn);

    await saveTaxDetails(ORG_ID, taxDetails as never, USER_ID);

    expect(db.integrationConnection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          provider: 'ZATCA',
          connectedByUserId: USER_ID,
        }),
      }),
    );
  });
});

describe('generateAndStoreCsr', () => {
  it('generates CSR and stores private key in secret store', async () => {
    const conn = makeConnection({ taxDetails: makeTaxDetails() });
    db.integrationConnection.findFirst.mockResolvedValue(conn);
    db.integrationConnection.findUniqueOrThrow.mockResolvedValue(conn);
    db.integrationConnection.update.mockResolvedValue(conn);

    const result = await generateAndStoreCsr(ORG_ID);

    expect(result.csrPem).toContain('MOCK_CSR');
    expect(mockSecretStore.set).toHaveBeenCalledWith('PRIVATE_KEY', 'MOCK_PRIVATE_KEY');
  });

  it('throws when tax details are missing', async () => {
    const conn = makeConnection({ taxDetails: undefined });
    db.integrationConnection.findFirst.mockResolvedValue(conn);

    await expect(generateAndStoreCsr(ORG_ID)).rejects.toThrow('zatcaTaxDetailsRequired');
  });

  it('updates connection step to compliance_csid', async () => {
    const conn = makeConnection({ taxDetails: makeTaxDetails() });
    db.integrationConnection.findFirst.mockResolvedValue(conn);
    db.integrationConnection.findUniqueOrThrow.mockResolvedValue(conn);
    db.integrationConnection.update.mockResolvedValue(conn);

    await generateAndStoreCsr(ORG_ID);

    expect(db.integrationConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          configJson: expect.objectContaining({
            currentStep: 'compliance_csid',
          }),
        }),
      }),
    );
  });
});

describe('requestComplianceCsid', () => {
  it('submits CSR to ZATCA and stores credentials in secret store', async () => {
    const conn = makeConnection({
      csrPem: '-----BEGIN CERTIFICATE REQUEST-----\nCSR\n-----END CERTIFICATE REQUEST-----',
    });
    db.integrationConnection.findFirst.mockResolvedValue(conn);
    db.integrationConnection.findUniqueOrThrow.mockResolvedValue(conn);
    db.integrationConnection.update.mockResolvedValue(conn);
    mockZatcaApiClient.requestComplianceCsid.mockResolvedValue({
      binarySecurityToken: 'mock-bst',
      secret: 'mock-secret',
      requestID: 'req-123',
    });

    const result = await requestComplianceCsid(ORG_ID);

    expect(result.requestId).toBe('req-123');
    expect(mockSecretStore.set).toHaveBeenCalledWith('X509_CERTIFICATE', 'mock-bst');
    expect(mockSecretStore.set).toHaveBeenCalledWith('API_SECRET', 'mock-secret');
    expect(mockSecretStore.set).toHaveBeenCalledWith('COMPLIANCE_REQUEST_ID', 'req-123');
  });

  it('throws when CSR PEM is missing', async () => {
    const conn = makeConnection({ csrPem: undefined });
    db.integrationConnection.findFirst.mockResolvedValue(conn);

    await expect(requestComplianceCsid(ORG_ID)).rejects.toThrow('zatcaCsrRequired');
  });

  it('updates connection step to compliance_checks', async () => {
    const conn = makeConnection({ csrPem: 'mock-csr' });
    db.integrationConnection.findFirst.mockResolvedValue(conn);
    db.integrationConnection.findUniqueOrThrow.mockResolvedValue(conn);
    db.integrationConnection.update.mockResolvedValue(conn);
    mockZatcaApiClient.requestComplianceCsid.mockResolvedValue({
      binarySecurityToken: 'bst',
      secret: 's',
      requestID: 'r',
    });

    await requestComplianceCsid(ORG_ID);

    expect(db.integrationConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          configJson: expect.objectContaining({
            currentStep: 'compliance_checks',
            certificateStatus: 'compliance',
          }),
        }),
      }),
    );
  });
});

describe('runComplianceChecks', () => {
  it('builds 6 test invoices and submits each, returning results array', async () => {
    const conn = makeConnection({ taxDetails: makeTaxDetails() });
    db.integrationConnection.findFirst.mockResolvedValue(conn);
    db.integrationConnection.findUniqueOrThrow.mockResolvedValue(conn);
    db.integrationConnection.update.mockResolvedValue(conn);
    mockSecretStore.get.mockResolvedValue('mock-value');
    mockZatcaApiClient.submitComplianceInvoice.mockResolvedValue({
      validationResults: { status: 'CLEARED' },
    });

    const results = await runComplianceChecks(ORG_ID);

    expect(results).toHaveLength(6);
    expect(results.every(r => r.status === 'CLEARED')).toBe(true);
    expect(mockZatcaApiClient.submitComplianceInvoice).toHaveBeenCalledTimes(6);
  });

  it('advances step to production_certificate when all checks pass', async () => {
    const conn = makeConnection({ taxDetails: makeTaxDetails() });
    db.integrationConnection.findFirst.mockResolvedValue(conn);
    db.integrationConnection.findUniqueOrThrow.mockResolvedValue(conn);
    db.integrationConnection.update.mockResolvedValue(conn);
    mockSecretStore.get.mockResolvedValue('mock-value');
    mockZatcaApiClient.submitComplianceInvoice.mockResolvedValue({
      validationResults: { status: 'CLEARED' },
    });

    await runComplianceChecks(ORG_ID);

    expect(db.integrationConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          configJson: expect.objectContaining({
            currentStep: 'production_certificate',
          }),
        }),
      }),
    );
  });

  it('captures ERROR status when an invoice submission throws', async () => {
    const conn = makeConnection({ taxDetails: makeTaxDetails() });
    db.integrationConnection.findFirst.mockResolvedValue(conn);
    db.integrationConnection.findUniqueOrThrow.mockResolvedValue(conn);
    db.integrationConnection.update.mockResolvedValue(conn);
    mockSecretStore.get.mockResolvedValue('mock-value');
    mockZatcaApiClient.submitComplianceInvoice
      .mockResolvedValueOnce({ validationResults: { status: 'CLEARED' } })
      .mockRejectedValueOnce(new Error('ZATCA timeout'))
      .mockResolvedValue({ validationResults: { status: 'CLEARED' } });

    const results = await runComplianceChecks(ORG_ID);

    expect(results).toHaveLength(6);
    const errorResult = results.find(r => r.status === 'ERROR');
    expect(errorResult).toBeDefined();
    expect(errorResult?.message).toBe('ZATCA timeout');
  });

  it('throws when tax details are missing', async () => {
    const conn = makeConnection({ taxDetails: undefined });
    db.integrationConnection.findFirst.mockResolvedValue(conn);

    await expect(runComplianceChecks(ORG_ID)).rejects.toThrow(
      'zatcaTaxDetailsRequiredForCompliance',
    );
  });

  it('throws when compliance credentials are missing from secret store', async () => {
    const conn = makeConnection({ taxDetails: makeTaxDetails() });
    db.integrationConnection.findFirst.mockResolvedValue(conn);
    mockSecretStore.get.mockResolvedValue(null);

    await expect(runComplianceChecks(ORG_ID)).rejects.toThrow('zatcaComplianceCsidRequired');
  });
});

describe('exchangeProductionCertificate', () => {
  it('exchanges compliance cert for production and updates connection to CONNECTED', async () => {
    const conn = makeConnection({ certificateStatus: 'compliance' });
    db.integrationConnection.findFirst.mockResolvedValue(conn);
    db.integrationConnection.findUniqueOrThrow.mockResolvedValue(conn);
    db.integrationConnection.update.mockResolvedValue(conn);
    mockSecretStore.get.mockResolvedValue('mock-value');
    mockZatcaApiClient.requestProductionCsid.mockResolvedValue({
      binarySecurityToken: 'prod-bst',
      secret: 'prod-secret',
    });

    await exchangeProductionCertificate(ORG_ID);

    expect(mockSecretStore.set).toHaveBeenCalledWith('X509_CERTIFICATE', 'prod-bst');
    expect(mockSecretStore.set).toHaveBeenCalledWith('API_SECRET', 'prod-secret');
    expect(mockSecretStore.delete).toHaveBeenCalledWith('COMPLIANCE_REQUEST_ID');
    expect(db.integrationConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CONNECTED',
          connectedAt: expect.any(Date),
          configJson: expect.objectContaining({
            certificateStatus: 'production',
            environment: 'production',
          }),
        }),
      }),
    );
  });

  it('throws when compliance credentials are missing', async () => {
    const conn = makeConnection();
    db.integrationConnection.findFirst.mockResolvedValue(conn);
    db.integrationConnection.findUniqueOrThrow.mockResolvedValue(conn);
    mockSecretStore.get.mockResolvedValue(null);

    await expect(exchangeProductionCertificate(ORG_ID)).rejects.toThrow(
      'zatcaComplianceChecksMustPass',
    );
  });
});

describe('getOnboardingState', () => {
  it('returns initial state when no connection exists', async () => {
    db.integrationConnection.findFirst.mockResolvedValue(null);

    const state = await getOnboardingState(ORG_ID);

    expect(state).toEqual({
      currentStep: 'tax_details',
      taxDetails: false,
      csrGenerated: false,
      complianceCsidReceived: false,
      complianceChecksPassed: false,
      productionCertActive: false,
    });
  });

  it('returns correct progress flags for mid-onboarding state', async () => {
    db.integrationConnection.findFirst.mockResolvedValue({
      configJson: {
        currentStep: 'compliance_checks',
        certificateStatus: 'compliance',
        taxDetails: makeTaxDetails(),
        csrPem: 'mock-csr',
      },
    });

    const state = await getOnboardingState(ORG_ID);

    expect(state).toEqual({
      currentStep: 'compliance_checks',
      taxDetails: true,
      csrGenerated: true,
      complianceCsidReceived: true,
      complianceChecksPassed: false,
      productionCertActive: false,
    });
  });

  it('returns fully completed state for production certificate', async () => {
    db.integrationConnection.findFirst.mockResolvedValue({
      configJson: {
        currentStep: 'production_certificate',
        certificateStatus: 'production',
        taxDetails: makeTaxDetails(),
        csrPem: 'mock-csr',
      },
    });

    const state = await getOnboardingState(ORG_ID);

    expect(state).toEqual({
      currentStep: 'production_certificate',
      taxDetails: true,
      csrGenerated: true,
      complianceCsidReceived: true,
      complianceChecksPassed: true,
      productionCertActive: true,
    });
  });
});
