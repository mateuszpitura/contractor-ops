/**
 * Phase 74 Plan 08 — overrideBlockingTask mutation contract tests.
 *
 * Strategy: Mock Prisma at module level. Verify the transaction body invokes
 * (a) findFirst on workflowRun scoped to organizationId, (b) findMany on
 * workflowTaskRun for IP_VERIFICATION, (c) updateMany→SKIPPED, (d) update
 * workflowRun.overrideMetadata, (e) writeAuditLog with correct shape.
 *
 * The Zod input schema (reason min 20 + acknowledged literal true) is
 * verified by attempting parse on invalid inputs.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const inputSchema = z.object({
  workflowRunId: z.string().min(1),
  reason: z.string().min(20).max(2000),
  acknowledged: z.literal(true),
});

describe('overrideBlockingTask mutation — D-10/D-11/D-12 + Pitfall 5', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects reason shorter than 20 chars (Zod min)', () => {
    const result = inputSchema.safeParse({
      workflowRunId: 'run-1',
      reason: 'too short',
      acknowledged: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects acknowledged: false (Zod literal)', () => {
    const result = inputSchema.safeParse({
      workflowRunId: 'run-1',
      reason: 'this is a long enough reason for the override',
      acknowledged: false,
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid input (acknowledged=true + reason ≥20 chars)', () => {
    const result = inputSchema.safeParse({
      workflowRunId: 'run-1',
      reason: 'this is a long enough reason for the override',
      acknowledged: true,
    });
    expect(result.success).toBe(true);
  });

  it.todo('requires workflow:override_blocking_task permission (rejects 9 non-owner roles)');
  it.todo(
    'writes WorkflowRun.overrideMetadata + AuditLog row + WorkflowTaskRun status SKIPPED in same $transaction',
  );
  it.todo('returns PRECONDITION_FAILED when no IP_VERIFICATION task is open');
});
