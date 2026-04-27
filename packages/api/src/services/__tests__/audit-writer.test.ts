// ---------------------------------------------------------------------------
// audit-writer tests — Phase 60 CLASS-08 Open Question #1.
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrismaCreate } = vi.hoisted(() => ({
  mockPrismaCreate: vi.fn(async () => ({ id: 'aud_test' })),
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    auditLog: { create: mockPrismaCreate },
  },
}));

vi.mock('@contractor-ops/logger', () => ({
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

import { writeAuditLog } from '../audit-writer.js';

describe('writeAuditLog', () => {
  beforeEach(() => {
    mockPrismaCreate.mockReset();
    mockPrismaCreate.mockResolvedValue({ id: 'aud_test' });
  });

  it('creates exactly one AuditLog row with the supplied fields (happy path)', async () => {
    await writeAuditLog({
      organizationId: 'org_1',
      actorType: 'USER',
      actorId: 'user_1',
      action: 'UPDATE',
      resourceType: 'CONTRACTOR',
      resourceId: 'asg_123',
      oldValues: { activeTo: '2026-01-01' },
      newValues: { activeTo: '2027-01-01' },
    });

    expect(mockPrismaCreate).toHaveBeenCalledTimes(1);
    const args = mockPrismaCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(args.data.organizationId).toBe('org_1');
    expect(args.data.actorType).toBe('USER');
    expect(args.data.resourceType).toBe('CONTRACTOR');
    expect(args.data.resourceId).toBe('asg_123');
    expect(args.data.oldValuesJson).toEqual({ activeTo: '2026-01-01' });
    expect(args.data.newValuesJson).toEqual({ activeTo: '2027-01-01' });
  });

  it('accepts a transaction client via `tx`', async () => {
    const txCreate = vi.fn(async () => ({ id: 'aud_tx' }));
    const tx = { auditLog: { create: txCreate } };

    await writeAuditLog({
      organizationId: 'org_1',
      actorType: 'SYSTEM',
      action: 'CREATE',
      resourceType: 'CONTRACT',
      resourceId: 'con_abc',
      newValues: { status: 'DRAFT' },
      tx,
    });

    expect(txCreate).toHaveBeenCalledTimes(1);
    // Base prisma.create must NOT be invoked when tx is supplied.
    expect(mockPrismaCreate).not.toHaveBeenCalled();
  });

  it('rejects calls missing organizationId', async () => {
    await expect(
      writeAuditLog({
        organizationId: '',
        actorType: 'USER',
        action: 'UPDATE',
        resourceType: 'CONTRACTOR',
        resourceId: 'asg_123',
      }),
    ).rejects.toThrow(/organizationId/);
  });

  it('rejects calls missing resourceId', async () => {
    await expect(
      writeAuditLog({
        organizationId: 'org_1',
        actorType: 'USER',
        action: 'UPDATE',
        resourceType: 'CONTRACTOR',
        resourceId: '',
      }),
    ).rejects.toThrow(/resourceId/);
  });

  it('propagates downstream errors so the enclosing transaction rolls back', async () => {
    mockPrismaCreate.mockRejectedValueOnce(new Error('db down'));
    await expect(
      writeAuditLog({
        organizationId: 'org_1',
        actorType: 'USER',
        action: 'DELETE',
        resourceType: 'CONTRACTOR',
        resourceId: 'asg_1',
      }),
    ).rejects.toThrow(/db down/);
  });
});
