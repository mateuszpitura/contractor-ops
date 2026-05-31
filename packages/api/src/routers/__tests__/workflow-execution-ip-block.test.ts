import { TRPCError } from '@trpc/server';
import { describe, expect, it } from 'vitest';
import { assertRunCompletable } from '../workflow/workflow-shared';

// In-memory gate client mirroring the RunGateClient structural shape.
function makeGateClient(opts: {
  overrideMetadata?: unknown;
  openIpTaskIds?: string[];
  pendingCreds?: Array<{ id: string; label: string; vaultProvider: string }>;
}) {
  return {
    workflowTaskRun: {
      findMany: async () => (opts.openIpTaskIds ?? []).map(id => ({ id })),
    },
    workflowRun: {
      findUniqueOrThrow: async () => ({ overrideMetadata: opts.overrideMetadata ?? null }),
    },
    credentialReference: {
      findMany: async () => opts.pendingCreds ?? [],
    },
  } as never;
}

describe('assertRunCompletable — IP_VERIFICATION hard-block (Phase 75 D-08)', () => {
  it('raises PRECONDITION_FAILED when an IP_VERIFICATION task is open and no override applied', async () => {
    const client = makeGateClient({ openIpTaskIds: ['task_ip'] });
    await expect(assertRunCompletable(client, 'run_1', 'org_1')).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });
  });

  it('error.cause includes { blockedTaskKind: "IP_VERIFICATION", openTaskIds: [...] }', async () => {
    const client = makeGateClient({ openIpTaskIds: ['t1', 't2'] });
    try {
      await assertRunCompletable(client, 'run_1', 'org_1');
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      const cause = (err as TRPCError).cause as { blockedTaskKind: string; openTaskIds: string[] };
      expect(cause.blockedTaskKind).toBe('IP_VERIFICATION');
      expect(cause.openTaskIds).toEqual(['t1', 't2']);
    }
  });

  it('multiple open IP_VERIFICATION tasks are all enumerated in openTaskIds', async () => {
    const client = makeGateClient({ openIpTaskIds: ['a', 'b', 'c'] });
    try {
      await assertRunCompletable(client, 'run_1', 'org_1');
      throw new Error('expected throw');
    } catch (err) {
      const cause = (err as TRPCError).cause as { openTaskIds: string[] };
      expect(cause.openTaskIds).toEqual(['a', 'b', 'c']);
    }
  });

  it('Phase 74 override (overrideMetadata.blockedTaskKind=IP_VERIFICATION) clears the IP block', async () => {
    const client = makeGateClient({
      openIpTaskIds: ['task_ip'],
      overrideMetadata: { blockedTaskKind: 'IP_VERIFICATION' },
    });
    // No IP throw — but no pending creds either, so it resolves.
    await expect(assertRunCompletable(client, 'run_1', 'org_1')).resolves.toBeUndefined();
  });

  it('no open IP_VERIFICATION tasks and no pending credentials → completable', async () => {
    const client = makeGateClient({ openIpTaskIds: [], pendingCreds: [] });
    await expect(assertRunCompletable(client, 'run_1', 'org_1')).resolves.toBeUndefined();
  });

  it.todo(
    'completing the IP_VERIFICATION task itself by webhook auto-clears the block (covered by Plan 75-08 esign test)',
  );
});
