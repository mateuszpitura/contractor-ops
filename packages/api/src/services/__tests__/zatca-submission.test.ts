import { describe, expect, it, vi } from 'vitest';

// Mock external dependencies before imports
vi.mock('@contractor-ops/db', () => ({
  prisma: {
    invoice: { findUniqueOrThrow: vi.fn() },
    integrationConnection: { findFirst: vi.fn(), updateMany: vi.fn() },
    zatcaInvoiceChain: { update: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@contractor-ops/einvoice', () => ({
  ZatcaApiClient: vi.fn(),
  ZatcaApiError: class ZatcaApiError extends Error {
    statusCode: number;
    errorType: string;
    constructor(msg: string, code: number, type: string) {
      super(msg);
      this.statusCode = code;
      this.errorType = type;
    }
  },
  ZatcaProfile: vi.fn().mockImplementation(() => ({
    generate: vi.fn().mockResolvedValue('<Invoice/>'),
    sign: { sign: vi.fn().mockResolvedValue('<SignedInvoice/>') },
  })),
  ZATCA_SANDBOX_URL: 'https://sandbox.test',
  ZATCA_PRODUCTION_URL: 'https://prod.test',
}));

vi.mock('@contractor-ops/integrations', () => ({
  createZatcaSecretStore: vi.fn().mockReturnValue({
    get: vi.fn().mockResolvedValue('mock-cert'),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  ZATCA_SECRET_NAMES: {
    X509_CERTIFICATE: 'X509_CERTIFICATE',
    PRIVATE_KEY: 'PRIVATE_KEY',
    API_SECRET: 'API_SECRET',
    COMPLIANCE_REQUEST_ID: 'COMPLIANCE_REQUEST_ID',
  },
}));

vi.mock('@contractor-ops/integrations/services/qstash-client', () => ({
  getQStashClient: vi.fn().mockReturnValue({
    publishJSON: vi.fn().mockResolvedValue({}),
  }),
}));

vi.mock('../zatca-hash-chain.js', () => ({
  acquireChainLock: vi.fn().mockResolvedValue(undefined),
  getNextChainEntry: vi.fn().mockResolvedValue({ icv: 1, pih: 'genesis-hash' }),
  recordChainEntry: vi.fn().mockResolvedValue({ id: 'chain_1' }),
}));

describe('zatca-submission', () => {
  it('submitToZatca function exists and is exported', async () => {
    const mod = await import('../zatca-submission.js');
    expect(typeof mod.submitToZatca).toBe('function');
  });

  it('handleZatcaSubmissionJob function exists and is exported', async () => {
    const mod = await import('../zatca-submission.js');
    expect(typeof mod.handleZatcaSubmissionJob).toBe('function');
  });
});
