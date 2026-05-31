import { TRPCError } from '@trpc/server';
import { describe, expect, it } from 'vitest';
import { assertRunCompletable } from '../workflow/workflow-shared';

function makeGateClient(pendingCreds: Array<{ id: string; label: string; vaultProvider: string }>) {
  return {
    workflowTaskRun: { findMany: async () => [] },
    workflowRun: { findUniqueOrThrow: async () => ({ overrideMetadata: null }) },
    credentialReference: { findMany: async () => pendingCreds },
  } as never;
}

describe('assertRunCompletable — soft-credential-warning gate (Phase 75 D-12)', () => {
  it('raises PRECONDITION_FAILED with cause.blockedTaskKind=PENDING_CREDENTIALS when PENDING credentials exist', async () => {
    const client = makeGateClient([
      { id: 'cr_1', label: 'AWS root', vaultProvider: 'ONE_PASSWORD' },
      { id: 'cr_2', label: 'GitHub PAT', vaultProvider: 'ONE_PASSWORD' },
      { id: 'cr_3', label: 'Stripe key', vaultProvider: 'ONE_PASSWORD' },
    ]);
    try {
      await assertRunCompletable(client, 'run_1', 'org_1');
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      const cause = (err as TRPCError).cause as {
        blockedTaskKind: string;
        pendingCredentials: unknown[];
      };
      expect(cause.blockedTaskKind).toBe('PENDING_CREDENTIALS');
      expect(cause.pendingCredentials).toHaveLength(3);
    }
  });

  it('warning payload contains id + label + vaultProvider per row but NOT vaultUrl or notes (privacy)', async () => {
    const client = makeGateClient([
      { id: 'cr_1', label: 'AWS root', vaultProvider: 'ONE_PASSWORD' },
    ]);
    try {
      await assertRunCompletable(client, 'run_1', 'org_1');
      throw new Error('expected throw');
    } catch (err) {
      const cause = (err as TRPCError).cause as {
        pendingCredentials: Array<Record<string, unknown>>;
      };
      const row = cause.pendingCredentials[0];
      expect(row).toHaveProperty('label');
      expect(row).toHaveProperty('vaultProvider');
      expect(row).not.toHaveProperty('vaultUrl');
      expect(row).not.toHaveProperty('notes');
    }
  });

  it('zero PENDING credentials → no warning, completable', async () => {
    const client = makeGateClient([]);
    await expect(assertRunCompletable(client, 'run_1', 'org_1')).resolves.toBeUndefined();
  });

  it.todo('forceCompleteRunWithPendingCredentials requires reason >= 20 chars (Zod min(20))');
  it.todo(
    'audit row workflow.completed_with_pending_credentials written with reason + count (full integration)',
  );
  it.todo('all credentials ROTATED or NOT_APPLICABLE → no warning (full integration)');
  it.todo(
    'forceCompleteRunWithPendingCredentials still respects IP_VERIFICATION block (defence-in-depth)',
  );
});
