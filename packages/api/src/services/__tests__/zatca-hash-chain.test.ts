import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockExecuteRawUnsafe = vi.fn();
const mockFindFirst = vi.fn();
const mockCreate = vi.fn();

const mockPrisma = {
  $executeRawUnsafe: mockExecuteRawUnsafe,
  zatcaInvoiceChain: {
    findFirst: mockFindFirst,
    create: mockCreate,
  },
};

import type { ChainEntry, PrismaLike, RecordChainData } from '../zatca-hash-chain';
import { acquireChainLock, getNextChainEntry, recordChainEntry } from '../zatca-hash-chain';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('acquireChainLock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes namespaced pg_advisory_xact_lock with the organizationId', async () => {
    // The 'org' namespace maps to class_id=2 in lib/advisory-lock.ts.
    // The two-arg form partitions the keyspace from cron / payment / sync
    // locks so cross-subsystem hashtext collisions can't deadlock.
    mockExecuteRawUnsafe.mockResolvedValue(undefined);

    await acquireChainLock(mockPrisma as unknown as PrismaLike, 'org_test');

    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(1);
    expect(mockExecuteRawUnsafe).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock($1, hashtext($2))',
      2,
      'org_test',
    );
  });

  it('propagates database errors', async () => {
    mockExecuteRawUnsafe.mockRejectedValue(new Error('DB connection failed'));

    await expect(acquireChainLock(mockPrisma as unknown as PrismaLike, 'org_test')).rejects.toThrow(
      'DB connection failed',
    );
  });
});

describe('getNextChainEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const GENESIS_PIH = crypto.createHash('sha256').update('0').digest('hex');

  it('returns icv=1 and PIH=SHA-256("0") for the first invoice', async () => {
    mockFindFirst.mockResolvedValue(null);

    const entry: ChainEntry = await getNextChainEntry(
      mockPrisma as unknown as PrismaLike,
      'org_new',
    );

    expect(entry.icv).toBe(1);
    expect(entry.pih).toBe(GENESIS_PIH);
    expect(entry.pih).toHaveLength(64); // SHA-256 hex
  });

  it('returns icv=N+1 and PIH=last hash for subsequent invoices', async () => {
    const lastHash = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    mockFindFirst.mockResolvedValue({ icv: 42, invoiceHash: lastHash });

    const entry = await getNextChainEntry(mockPrisma as unknown as PrismaLike, 'org_existing');

    expect(entry.icv).toBe(43);
    expect(entry.pih).toBe(lastHash);
  });

  it('queries with correct orderBy descending icv', async () => {
    mockFindFirst.mockResolvedValue(null);

    await getNextChainEntry(mockPrisma as unknown as PrismaLike, 'org_test');

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { organizationId: 'org_test' },
      orderBy: { icv: 'desc' },
      select: { icv: true, invoiceHash: true },
    });
  });

  it('genesis PIH is deterministic', async () => {
    mockFindFirst.mockResolvedValue(null);

    const entry1 = await getNextChainEntry(mockPrisma as unknown as PrismaLike, 'org_a');
    const entry2 = await getNextChainEntry(mockPrisma as unknown as PrismaLike, 'org_b');

    expect(entry1.pih).toBe(entry2.pih);
    expect(entry1.pih).toBe(GENESIS_PIH);
  });
});

describe('recordChainEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a ZatcaInvoiceChain record with PENDING status', async () => {
    mockCreate.mockResolvedValue({ id: 'chain_abc' });

    const data: RecordChainData = {
      organizationId: 'org_test',
      icv: 5,
      invoiceId: 'inv_42',
      invoiceHash: 'hash-of-signed-xml',
      previousHash: 'hash-of-previous',
      zatcaUuid: 'uuid-v4-value',
    };

    const result = await recordChainEntry(mockPrisma as unknown as PrismaLike, data);

    expect(result).toEqual({ id: 'chain_abc' });
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        organizationId: 'org_test',
        icv: 5,
        invoiceId: 'inv_42',
        invoiceHash: 'hash-of-signed-xml',
        previousHash: 'hash-of-previous',
        zatcaUuid: 'uuid-v4-value',
        zatcaStatus: 'PENDING',
      },
    });
  });

  it('returns the created record id', async () => {
    mockCreate.mockResolvedValue({ id: 'chain_xyz' });

    const data: RecordChainData = {
      organizationId: 'org_1',
      icv: 1,
      invoiceId: 'inv_1',
      invoiceHash: 'h1',
      previousHash: 'h0',
      zatcaUuid: 'uuid-1',
    };

    const result = await recordChainEntry(mockPrisma as unknown as PrismaLike, data);
    expect(result.id).toBe('chain_xyz');
  });

  it('propagates create errors', async () => {
    mockCreate.mockRejectedValue(new Error('Unique constraint violation'));

    const data: RecordChainData = {
      organizationId: 'org_1',
      icv: 1,
      invoiceId: 'inv_1',
      invoiceHash: 'h1',
      previousHash: 'h0',
      zatcaUuid: 'uuid-1',
    };

    await expect(recordChainEntry(mockPrisma as unknown as PrismaLike, data)).rejects.toThrow(
      'Unique constraint violation',
    );
  });
});
