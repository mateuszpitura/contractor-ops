// planWorkerBackfill idempotency contract (terminal RED until the backfill
// script lands).
//
// RED until `packages/db/scripts/backfill-worker.ts` is created exporting the
// pure `planWorkerBackfill(rows)` transform — one Worker insert per contractor
// that has no worker link yet, skipping contractors already carrying a workerId
// so a re-run produces zero new inserts. The import below resolves to a
// not-yet-existing module, so the suite fails at module resolution (Cannot find
// module). It pins the idempotency + re-run-safety + no-mutation invariants the
// backfill must satisfy before it ever writes a row, mirroring the free-zone
// backfill transform tests.

import { describe, expect, it } from 'vitest';
import type { ContractorForWorker } from '../../scripts/backfill-worker.js';
import { planWorkerBackfill } from '../../scripts/backfill-worker.js';

function contractor(overrides: Partial<ContractorForWorker> = {}): ContractorForWorker {
  return {
    id: 'ctr_1',
    organizationId: 'org_1',
    displayName: 'Alpha Consulting',
    email: 'alpha@example.com',
    workerId: null,
    ...overrides,
  };
}

describe('planWorkerBackfill idempotency', () => {
  it('plans one Worker insert per unlinked contractor carrying its org + identity', () => {
    const plan = planWorkerBackfill([contractor()]);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({
      contractorId: 'ctr_1',
      worker: {
        organizationId: 'org_1',
        displayName: 'Alpha Consulting',
        email: 'alpha@example.com',
      },
    });
  });

  it('skips a contractor that already carries a workerId (idempotency guard)', () => {
    const plan = planWorkerBackfill([contractor({ workerId: 'wrk_existing' })]);
    expect(plan).toEqual([]);
  });

  it('produces zero new inserts when re-run over its own already-linked output', () => {
    const rows = [contractor({ id: 'ctr_1' }), contractor({ id: 'ctr_2', email: null })];
    const first = planWorkerBackfill(rows);
    expect(first).toHaveLength(2);

    // Simulate the post-apply state: every planned contractor now carries a
    // worker link. A second pass must be a no-op (the WHERE workerId IS NULL
    // guard the script issues, modeled here on the transform).
    const linked = rows.map(r => ({ ...r, workerId: `wrk_${r.id}` }));
    const second = planWorkerBackfill(linked);
    expect(second).toEqual([]);
  });

  it('never mutates the source rows', () => {
    const rows = [contractor()];
    const snapshot = JSON.parse(JSON.stringify(rows));
    planWorkerBackfill(rows);
    expect(rows).toEqual(snapshot);
  });

  it('plans only the unlinked contractors in a mixed batch', () => {
    const plan = planWorkerBackfill([
      contractor({ id: 'ctr_a', workerId: null }),
      contractor({ id: 'ctr_b', workerId: 'wrk_b' }),
      contractor({ id: 'ctr_c', workerId: null }),
    ]);
    expect(plan.map(p => p.contractorId).sort()).toEqual(['ctr_a', 'ctr_c']);
  });
});
