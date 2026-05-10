/** @vitest-environment node */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockDocumentFindMany,
  mockDocumentDeleteMany,
  mockDocumentLinkDeleteMany,
  mockInvoiceFileDeleteMany,
  mockInvoiceDeleteMany,
  mockContractDeleteMany,
  mockContractorDeleteMany,
  mockDeleteObject,
  mockPurgeExpiredOAuthChallenges,
  mockPurgeExpiredPendingUploads,
} = vi.hoisted(() => ({
  mockDocumentFindMany: vi.fn(),
  mockDocumentDeleteMany: vi.fn(),
  mockDocumentLinkDeleteMany: vi.fn(),
  mockInvoiceFileDeleteMany: vi.fn(),
  mockInvoiceDeleteMany: vi.fn(),
  mockContractDeleteMany: vi.fn(),
  mockContractorDeleteMany: vi.fn(),
  mockDeleteObject: vi.fn(),
  mockPurgeExpiredOAuthChallenges: vi.fn(),
  mockPurgeExpiredPendingUploads: vi.fn(),
}));

vi.mock('@contractor-ops/db', () => {
  const tx = {
    document: {
      findMany: mockDocumentFindMany,
      deleteMany: mockDocumentDeleteMany,
    },
    documentLink: {
      deleteMany: mockDocumentLinkDeleteMany,
    },
    invoiceFile: {
      deleteMany: mockInvoiceFileDeleteMany,
    },
    invoice: {
      deleteMany: mockInvoiceDeleteMany,
    },
    contract: {
      deleteMany: mockContractDeleteMany,
    },
    contractor: {
      deleteMany: mockContractorDeleteMany,
    },
  };
  return {
    prisma: {
      ...tx,
      $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(tx),
    },
  };
});

vi.mock('@sentry/nextjs', () => ({
  withMonitor: vi.fn((_name: string, fn: () => Promise<Response>) => fn()),
  captureException: vi.fn(),
}));

vi.mock('@contractor-ops/api/services/cron-monitor', () => ({
  withCronMonitor: vi.fn((_name: string, fn: () => Promise<Response>) => fn()),
}));

vi.mock('@contractor-ops/logger', () => ({
  createCronLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { gauge: vi.fn() },
}));

vi.mock('@contractor-ops/api/services/r2', () => ({
  deleteObject: mockDeleteObject,
}));

vi.mock('@contractor-ops/api/services/oauth-challenge', () => ({
  purgeExpiredOAuthChallenges: mockPurgeExpiredOAuthChallenges,
}));

vi.mock('@contractor-ops/api/services/pending-upload', () => ({
  purgeExpiredPendingUploads: mockPurgeExpiredPendingUploads,
}));

vi.mock('@contractor-ops/validators', () => ({
  getServerEnv: vi.fn(() => ({ CRON_SECRET: 'test-cron-secret-16chars' })),
}));

import { GET } from '../route';

describe('GET /api/cron/data-purge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteObject.mockResolvedValue(undefined);
    mockDocumentFindMany.mockResolvedValue([]);
    mockDocumentDeleteMany.mockResolvedValue({ count: 0 });
    mockDocumentLinkDeleteMany.mockResolvedValue({ count: 0 });
    mockInvoiceFileDeleteMany.mockResolvedValue({ count: 0 });
    mockInvoiceDeleteMany.mockResolvedValue({ count: 0 });
    mockContractDeleteMany.mockResolvedValue({ count: 0 });
    mockContractorDeleteMany.mockResolvedValue({ count: 0 });
    mockPurgeExpiredOAuthChallenges.mockResolvedValue(0);
    mockPurgeExpiredPendingUploads.mockResolvedValue(0);
  });

  it('returns 401 when unauthorized', async () => {
    process.env.CRON_SECRET = 's';
    const req = new NextRequest('http://localhost/api/cron/data-purge', {
      headers: { authorization: 'Bearer bad' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with purge summary when authorized', async () => {
    process.env.CRON_SECRET = 'test-cron-secret-16chars';
    const req = new NextRequest('http://localhost/api/cron/data-purge', {
      headers: { authorization: 'Bearer test-cron-secret-16chars' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      totalPurged: number;
      retentionDays: number;
      purged: Record<string, number>;
    };
    expect(json.retentionDays).toBe(90);
    expect(json.totalPurged).toBe(0);
    expect(json.purged).toMatchObject({
      documents: 0,
      invoices: 0,
      contracts: 0,
      contractors: 0,
    });
    expect(mockDocumentFindMany).toHaveBeenCalled();
  });

  it('calls R2 deleteObject for expired documents with storageKey', async () => {
    process.env.CRON_SECRET = 'test-cron-secret-16chars';
    mockDocumentFindMany.mockResolvedValue([
      { id: 'doc-1', storageKey: 'orgs/o/documents/f1.pdf' },
      { id: 'doc-2', storageKey: null },
    ]);
    mockDocumentLinkDeleteMany.mockResolvedValue({ count: 1 });
    mockInvoiceFileDeleteMany.mockResolvedValue({ count: 0 });

    const req = new NextRequest('http://localhost/api/cron/data-purge', {
      headers: { authorization: 'Bearer test-cron-secret-16chars' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      purged: Record<string, number>;
      totalPurged: number;
    };
    expect(mockDeleteObject).toHaveBeenCalledTimes(1);
    expect(mockDeleteObject).toHaveBeenCalledWith('orgs/o/documents/f1.pdf');
    expect(json.purged.r2Files).toBe(1);
    expect(json.purged.documentLinks).toBe(1);
  });

  it('invokes ephemeral-table purge helpers and surfaces row counts', async () => {
    process.env.CRON_SECRET = 'test-cron-secret-16chars';
    mockPurgeExpiredOAuthChallenges.mockResolvedValue(7);
    mockPurgeExpiredPendingUploads.mockResolvedValue(3);

    const req = new NextRequest('http://localhost/api/cron/data-purge', {
      headers: { authorization: 'Bearer test-cron-secret-16chars' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { purged: Record<string, number> };

    expect(mockPurgeExpiredOAuthChallenges).toHaveBeenCalledTimes(1);
    expect(mockPurgeExpiredPendingUploads).toHaveBeenCalledTimes(1);
    expect(json.purged.oauthChallenges).toBe(7);
    expect(json.purged.pendingUploads).toBe(3);
  });

  it('does not abort the cron run when one purge helper throws', async () => {
    process.env.CRON_SECRET = 'test-cron-secret-16chars';
    mockPurgeExpiredOAuthChallenges.mockRejectedValue(new Error('db unavailable'));
    mockPurgeExpiredPendingUploads.mockResolvedValue(2);

    const req = new NextRequest('http://localhost/api/cron/data-purge', {
      headers: { authorization: 'Bearer test-cron-secret-16chars' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { purged: Record<string, number> };

    // OAuth purge failed but pending-upload purge still ran.
    expect(json.purged.oauthChallenges).toBe(0);
    expect(json.purged.pendingUploads).toBe(2);
    expect(mockPurgeExpiredPendingUploads).toHaveBeenCalledTimes(1);
  });
});
