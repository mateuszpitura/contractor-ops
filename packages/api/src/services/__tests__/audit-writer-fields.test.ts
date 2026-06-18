/**
 * AuditLog writer — field-capture + atomicity completeness.
 *
 * `audit-writer.test.ts` covers the happy-path org/actor/resource/old-new shape.
 * This suite closes the documented gaps: the forensic fields (`ipAddress`,
 * `userAgent`, `action`) must be persisted verbatim, the before/after/metadata
 * objects must land in their `*Json` columns, the insert must route through the
 * caller-supplied `tx` (so the audit row commits/rolls back atomically with the
 * business mutation — the same-tx invariant), and the required-key guards must
 * throw before any write.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    auditLog: { create: vi.fn(async () => ({})), createMany: vi.fn(async () => ({ count: 0 })) },
  },
}));

vi.mock('@contractor-ops/db', () => ({ prisma: mockPrisma }));
vi.mock('@contractor-ops/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { writeAuditLog, writeAuditLogMany } from '../audit-writer';

function makeTx() {
  return {
    auditLog: { create: vi.fn(async () => ({})), createMany: vi.fn(async () => ({ count: 0 })) },
  };
}

const base = {
  organizationId: 'org-1',
  actorType: 'USER' as const,
  actorId: 'user-1',
  actorName: 'Jane',
  action: 'contract.amend',
  resourceType: 'CONTRACT' as const,
  resourceId: 'contract-1',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('writeAuditLog — forensic field capture', () => {
  it('persists ipAddress, userAgent, and action verbatim', async () => {
    const tx = makeTx();
    await writeAuditLog({
      ...base,
      ipAddress: '203.0.113.7',
      userAgent: 'Mozilla/5.0 (test)',
      tx,
    });
    const data = tx.auditLog.create.mock.calls[0]?.[0]?.data;
    expect(data).toMatchObject({
      action: 'contract.amend',
      ipAddress: '203.0.113.7',
      userAgent: 'Mozilla/5.0 (test)',
    });
  });

  it('maps oldValues/newValues/metadata into their *Json columns', async () => {
    const tx = makeTx();
    await writeAuditLog({
      ...base,
      oldValues: { amount: 100 },
      newValues: { amount: 200 },
      metadata: { reason: 'rate change' },
      tx,
    });
    const data = tx.auditLog.create.mock.calls[0]?.[0]?.data;
    expect(data.oldValuesJson).toEqual({ amount: 100 });
    expect(data.newValuesJson).toEqual({ amount: 200 });
    expect(data.metadataJson).toEqual({ reason: 'rate change' });
  });

  it('defaults omitted optional fields to null (no undefined leakage)', async () => {
    const tx = makeTx();
    await writeAuditLog({
      organizationId: 'org-1',
      actorType: 'SYSTEM',
      action: 'reassessment.scan',
      resourceType: 'CONTRACTOR',
      resourceId: 'c-1',
      tx,
    });
    const data = tx.auditLog.create.mock.calls[0]?.[0]?.data;
    expect(data.actorId).toBeNull();
    expect(data.actorName).toBeNull();
    expect(data.resourceName).toBeNull();
    expect(data.ipAddress).toBeNull();
    expect(data.userAgent).toBeNull();
  });
});

describe('writeAuditLog — atomic transaction routing', () => {
  it('writes through the supplied tx client, never the default prisma', async () => {
    const tx = makeTx();
    await writeAuditLog({ ...base, tx });
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('falls back to the default prisma client when no tx is supplied', async () => {
    await writeAuditLog(base);
    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
  });
});

describe('writeAuditLog — required-key guards (append-only precondition)', () => {
  it('throws when organizationId is missing, before any write', async () => {
    const tx = makeTx();
    await expect(writeAuditLog({ ...base, organizationId: '', tx })).rejects.toThrow(
      /organizationId is required/,
    );
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('throws when resourceId is missing, before any write', async () => {
    const tx = makeTx();
    await expect(writeAuditLog({ ...base, resourceId: '', tx })).rejects.toThrow(
      /resourceId is required/,
    );
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});

describe('writeAuditLogMany — batch insert', () => {
  it('inserts all rows in one createMany on the supplied tx', async () => {
    const tx = makeTx();
    await writeAuditLogMany({
      rows: [
        { ...base, resourceId: 'c-1' },
        { ...base, resourceId: 'c-2' },
      ],
      tx,
    });
    expect(tx.auditLog.createMany).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.createMany.mock.calls[0]?.[0]?.data).toHaveLength(2);
  });

  it('is a no-op on empty rows (no DB round-trip)', async () => {
    const tx = makeTx();
    await writeAuditLogMany({ rows: [], tx });
    expect(tx.auditLog.createMany).not.toHaveBeenCalled();
  });
});
