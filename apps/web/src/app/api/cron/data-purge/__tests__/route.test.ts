/** @vitest-environment node */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDocumentFindMany = vi.fn();
const mockDocumentDeleteMany = vi.fn();
const mockDocumentLinkDeleteMany = vi.fn();
const mockInvoiceFileDeleteMany = vi.fn();
const mockInvoiceDeleteMany = vi.fn();
const mockContractDeleteMany = vi.fn();
const mockContractorDeleteMany = vi.fn();

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    document: {
      findMany: (...args: unknown[]) => mockDocumentFindMany(...args),
      deleteMany: (...args: unknown[]) => mockDocumentDeleteMany(...args),
    },
    documentLink: {
      deleteMany: (...args: unknown[]) => mockDocumentLinkDeleteMany(...args),
    },
    invoiceFile: {
      deleteMany: (...args: unknown[]) => mockInvoiceFileDeleteMany(...args),
    },
    invoice: {
      deleteMany: (...args: unknown[]) => mockInvoiceDeleteMany(...args),
    },
    contract: {
      deleteMany: (...args: unknown[]) => mockContractDeleteMany(...args),
    },
    contractor: {
      deleteMany: (...args: unknown[]) => mockContractorDeleteMany(...args),
    },
  },
}));

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

const mockDeleteObject = vi.fn();

vi.mock('@contractor-ops/api/services/r2', () => ({
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
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
    process.env.CRON_SECRET = 'purge-secret';
    const req = new NextRequest('http://localhost/api/cron/data-purge', {
      headers: { authorization: 'Bearer purge-secret' },
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
    process.env.CRON_SECRET = 'purge-secret';
    mockDocumentFindMany.mockResolvedValue([
      { id: 'doc-1', storageKey: 'orgs/o/documents/f1.pdf' },
      { id: 'doc-2', storageKey: null },
    ]);
    mockDocumentLinkDeleteMany.mockResolvedValue({ count: 1 });
    mockInvoiceFileDeleteMany.mockResolvedValue({ count: 0 });

    const req = new NextRequest('http://localhost/api/cron/data-purge', {
      headers: { authorization: 'Bearer purge-secret' },
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
});
