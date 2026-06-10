import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DbClient } from '../types';

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: {},
  prismaRaw: {},
}));

const mockDecryptCredentials = vi.fn();
vi.mock('@contractor-ops/integrations/services/credential-service', () => ({
  decryptCredentials: (...args: unknown[]) => mockDecryptCredentials(...args),
}));

const mockStorecoveAdapterInstances: Array<{ apiKey: string; baseUrl: string }> = [];
vi.mock('@contractor-ops/einvoice', () => ({
  StorecoveAdapter: class MockStorecoveAdapter {
    constructor(opts: { apiKey: string; baseUrl: string }) {
      mockStorecoveAdapterInstances.push(opts);
    }
  },
}));

import { buildStorecoveAdapterForOrg } from '../peppol-adapter-factory';

function makeMockDb() {
  return {
    integrationConnection: { findFirst: vi.fn() },
  } as unknown as DbClient;
}

const ORG_ID = 'org-test-123';
const SANDBOX_URL = 'https://api-sandbox.storecove.com/api/v2';
const PRODUCTION_URL = 'https://api.storecove.com/api/v2';

describe('buildStorecoveAdapterForOrg', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorecoveAdapterInstances.length = 0;
  });

  it('returns null when no PEPPOL connection exists', async () => {
    const db = makeMockDb();
    (db.integrationConnection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await buildStorecoveAdapterForOrg(db, ORG_ID);

    expect(result).toBeNull();
    expect(db.integrationConnection.findFirst).toHaveBeenCalledWith({
      where: { organizationId: ORG_ID, provider: 'PEPPOL', status: 'CONNECTED' },
      select: { credentialsRef: true, configJson: true },
    });
  });

  it('returns null when connection has no credentialsRef', async () => {
    const db = makeMockDb();
    (db.integrationConnection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      credentialsRef: null,
      configJson: null,
    });

    const result = await buildStorecoveAdapterForOrg(db, ORG_ID);

    expect(result).toBeNull();
    expect(mockDecryptCredentials).not.toHaveBeenCalled();
  });

  it('returns null when decrypted credentials have no accessToken', async () => {
    const db = makeMockDb();
    (db.integrationConnection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      credentialsRef: 'enc:ref:abc',
      configJson: null,
    });
    mockDecryptCredentials.mockReturnValue({ accessToken: '' });

    const result = await buildStorecoveAdapterForOrg(db, ORG_ID);

    expect(result).toBeNull();
    expect(mockDecryptCredentials).toHaveBeenCalledWith('enc:ref:abc', 'peppol');
    expect(mockStorecoveAdapterInstances).toHaveLength(0);
  });

  it('uses production base URL when configJson.environment is production', async () => {
    const db = makeMockDb();
    (db.integrationConnection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      credentialsRef: 'enc:ref:prod',
      configJson: { environment: 'production' },
    });
    mockDecryptCredentials.mockReturnValue({ accessToken: 'sk-prod-key' });

    const result = await buildStorecoveAdapterForOrg(db, ORG_ID);

    expect(result).not.toBeNull();
    expect(mockStorecoveAdapterInstances).toHaveLength(1);
    expect(mockStorecoveAdapterInstances[0]).toEqual({
      apiKey: 'sk-prod-key',
      baseUrl: PRODUCTION_URL,
    });
  });

  it('uses sandbox base URL by default', async () => {
    const db = makeMockDb();
    (db.integrationConnection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      credentialsRef: 'enc:ref:sandbox',
      configJson: {},
    });
    mockDecryptCredentials.mockReturnValue({ accessToken: 'sk-sandbox-key' });

    const result = await buildStorecoveAdapterForOrg(db, ORG_ID);

    expect(result).not.toBeNull();
    expect(mockStorecoveAdapterInstances).toHaveLength(1);
    expect(mockStorecoveAdapterInstances[0]).toEqual({
      apiKey: 'sk-sandbox-key',
      baseUrl: SANDBOX_URL,
    });
  });

  it('uses production base URL when blob.extra.environment is production', async () => {
    const db = makeMockDb();
    (db.integrationConnection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      credentialsRef: 'enc:ref:blob-prod',
      configJson: {},
    });
    mockDecryptCredentials.mockReturnValue({
      accessToken: 'sk-blob-prod-key',
      extra: { environment: 'production' },
    });

    const result = await buildStorecoveAdapterForOrg(db, ORG_ID);

    expect(result).not.toBeNull();
    expect(mockStorecoveAdapterInstances).toHaveLength(1);
    expect(mockStorecoveAdapterInstances[0]).toEqual({
      apiKey: 'sk-blob-prod-key',
      baseUrl: PRODUCTION_URL,
    });
  });
});
