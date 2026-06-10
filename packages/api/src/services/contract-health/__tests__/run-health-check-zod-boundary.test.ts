// Regression: a ZodError from the Anthropic tool_use boundary must
// produce MANUAL_REVIEW_REQUIRED (not FAILED) from runContractHealthCheck.
//
// Uses an in-memory Prisma double + module mocks so no real Anthropic / R2
// calls are made.

import type { PrismaClient } from '@contractor-ops/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any subject import.
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/integrations', async () => {
  const { ZodError: ZE } = await import('zod');
  return {
    evaluateContractIpAssignment: vi.fn(),
    fetchWithTimeout: vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(Buffer.from('pdf').buffer),
    }),
    // re-export anything else as undefined — not needed by run-health-check
    ZodError: ZE,
  };
});

vi.mock('../../r2.js', () => ({
  createPresignedDownloadUrl: vi.fn().mockResolvedValue('https://r2.example.com/doc.pdf'),
}));

vi.mock('../../audit-writer.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../cross-jurisdiction.js', () => ({
  resolveContractJurisdiction: vi.fn().mockResolvedValue('UK'),
  analyzeCrossJurisdiction: vi.fn().mockReturnValue({ mismatch: false }),
}));

vi.mock('../dedup.js', () => ({
  findExistingSucceededRun: vi.fn().mockResolvedValue(null),
}));

vi.mock('../materialise.js', () => ({
  materialiseLikelyMissing: vi.fn().mockResolvedValue({ contractorComplianceItemId: 'item_1' }),
}));

vi.mock('../model.js', () => ({
  CONTRACT_HEALTH_MODEL_VER: 'claude-sonnet-4-6',
}));

// ---------------------------------------------------------------------------
// Subject import (after mocks are wired).
// ---------------------------------------------------------------------------

import { evaluateContractIpAssignment } from '@contractor-ops/integrations';
import { runContractHealthCheck } from '../run-health-check.js';

// ---------------------------------------------------------------------------
// Minimal Prisma double.
// ---------------------------------------------------------------------------

function makePrisma(): PrismaClient {
  const update = vi.fn().mockResolvedValue({});
  const create = vi.fn().mockResolvedValue({ id: 'run_1' });

  const base = {
    contractHealthCheckRun: { create, update, findFirst: vi.fn().mockResolvedValue(null) },
    documentLink: {
      findFirst: vi.fn().mockResolvedValue({ document: { storageKey: 'key/doc.pdf' } }),
    },
    contract: {
      update: vi.fn().mockResolvedValue({}),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ contractorId: 'ctr_1' }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };

  return {
    ...base,
    $transaction: vi.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        ...base,
        contractorComplianceItem: { upsert: vi.fn().mockResolvedValue({}) },
      }),
    ),
  } as unknown as PrismaClient;
}

// ---------------------------------------------------------------------------
// Tests.
// ---------------------------------------------------------------------------

describe('runContractHealthCheck — ZodError from tool_use boundary (WR-6)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('yields MANUAL_REVIEW_REQUIRED when the tool_use body fails Zod schema validation', async () => {
    const zodErr = new ZodError([
      {
        code: 'invalid_enum_value',
        path: ['verdict'],
        message: 'Invalid enum value',
        options: [],
        received: 'BAD_VERDICT',
      },
    ]);
    vi.mocked(evaluateContractIpAssignment).mockRejectedValueOnce(zodErr);

    const result = await runContractHealthCheck({
      db: makePrisma(),
      organizationId: 'org_1',
      contractId: 'ct_1',
      triggeredBy: 'MANUAL',
    });

    // Must not be FAILED — a malformed model response is not an infra error.
    expect(result.status).toBe('SUCCEEDED');
    expect(result.verdict).toBe('MANUAL_REVIEW_REQUIRED');
  });

  it('yields FAILED for infrastructure errors (non-ZodError)', async () => {
    vi.mocked(evaluateContractIpAssignment).mockRejectedValueOnce(
      new Error('Anthropic 503 Service Unavailable'),
    );

    const result = await runContractHealthCheck({
      db: makePrisma(),
      organizationId: 'org_1',
      contractId: 'ct_1',
      triggeredBy: 'MANUAL',
    });

    expect(result.status).toBe('FAILED');
  });
});
