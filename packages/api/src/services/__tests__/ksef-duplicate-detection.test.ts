import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkCrossSourceDuplicate, linkDuplicateInvoices } from '../ksef-duplicate-detection';

// ---------------------------------------------------------------------------
// Mock DB client (passed as argument, no module mock needed)
// ---------------------------------------------------------------------------

const mockDb = {
  invoice: {
    findFirst: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
} as unknown as Parameters<typeof checkCrossSourceDuplicate>[0];

// Type-safe handle for assertions
const db = mockDb as unknown as {
  invoice: {
    findFirst: ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const ORG_ID = 'org-dup-1';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// checkCrossSourceDuplicate
// ---------------------------------------------------------------------------

describe('checkCrossSourceDuplicate', () => {
  it('returns isDuplicate: false when no match exists', async () => {
    db.invoice.findFirst.mockResolvedValue(null);

    const result = await checkCrossSourceDuplicate(mockDb, ORG_ID, 'FV/2026/001', '1234567890');

    expect(result).toEqual({
      isDuplicate: false,
      existingInvoiceId: null,
      existingSource: null,
    });
  });

  it('returns isDuplicate: true with existing invoice info when match found', async () => {
    db.invoice.findFirst.mockResolvedValue({ id: 'inv-existing', source: 'MANUAL' });

    const result = await checkCrossSourceDuplicate(mockDb, ORG_ID, 'FV/2026/002', '9999999999');

    expect(result).toEqual({
      isDuplicate: true,
      existingInvoiceId: 'inv-existing',
      existingSource: 'MANUAL',
    });
  });

  it('uses case-insensitive match on invoiceNumber', async () => {
    db.invoice.findFirst.mockResolvedValue(null);

    await checkCrossSourceDuplicate(mockDb, ORG_ID, 'fv/2026/003', '1111111111');

    const whereArg = db.invoice.findFirst.mock.calls[0][0].where;
    expect(whereArg.invoiceNumber).toEqual({
      equals: 'fv/2026/003',
      mode: 'insensitive',
    });
  });

  it('excludes own ID when excludeInvoiceId is provided', async () => {
    db.invoice.findFirst.mockResolvedValue(null);

    await checkCrossSourceDuplicate(mockDb, ORG_ID, 'FV/2026/004', '2222222222', 'inv-self');

    const whereArg = db.invoice.findFirst.mock.calls[0][0].where;
    expect(whereArg.id).toEqual({ not: 'inv-self' });
  });

  it('does not include id filter when excludeInvoiceId is omitted', async () => {
    db.invoice.findFirst.mockResolvedValue(null);

    await checkCrossSourceDuplicate(mockDb, ORG_ID, 'FV/2026/005', '3333333333');

    const whereArg = db.invoice.findFirst.mock.calls[0][0].where;
    expect(whereArg.id).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// linkDuplicateInvoices
// ---------------------------------------------------------------------------

describe('linkDuplicateInvoices', () => {
  it('updates both invoices with cross-reference flags', async () => {
    db.invoice.findUniqueOrThrow
      .mockResolvedValueOnce({ flagsJson: null })
      .mockResolvedValueOnce({ flagsJson: null });
    db.invoice.update.mockResolvedValue({});

    await linkDuplicateInvoices(mockDb, 'inv-ksef', 'inv-manual');

    expect(db.invoice.update).toHaveBeenCalledTimes(2);

    const ksefCall = db.invoice.update.mock.calls.find(
      (c: unknown[]) => (c[0] as { where: { id: string } }).where.id === 'inv-ksef',
    );
    const manualCall = db.invoice.update.mock.calls.find(
      (c: unknown[]) => (c[0] as { where: { id: string } }).where.id === 'inv-manual',
    );

    expect(ksefCall?.[0].data.flagsJson).toEqual(
      expect.objectContaining({ duplicateOf: 'inv-manual', duplicateSource: 'MANUAL' }),
    );
    expect(manualCall?.[0].data.flagsJson).toEqual(
      expect.objectContaining({ duplicateOf: 'inv-ksef', duplicateSource: 'KSEF' }),
    );
  });

  it('preserves existing flags when adding duplicate link', async () => {
    db.invoice.findUniqueOrThrow
      .mockResolvedValueOnce({ flagsJson: { urgent: true, note: 'test' } })
      .mockResolvedValueOnce({ flagsJson: { reviewed: true } });
    db.invoice.update.mockResolvedValue({});

    await linkDuplicateInvoices(mockDb, 'inv-ksef', 'inv-manual');

    const ksefCall = db.invoice.update.mock.calls.find(
      (c: unknown[]) => (c[0] as { where: { id: string } }).where.id === 'inv-ksef',
    );
    const manualCall = db.invoice.update.mock.calls.find(
      (c: unknown[]) => (c[0] as { where: { id: string } }).where.id === 'inv-manual',
    );

    expect(ksefCall?.[0].data.flagsJson).toMatchObject({
      urgent: true,
      note: 'test',
      duplicateOf: 'inv-manual',
    });
    expect(manualCall?.[0].data.flagsJson).toMatchObject({
      reviewed: true,
      duplicateOf: 'inv-ksef',
    });
  });
});
