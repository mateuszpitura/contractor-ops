// Phase 75 D-03 — Idempotency dedup. The partial unique index
// (Plan 75-02) enforces (contractId, contentHash, modelVer) uniqueness ONLY
// when status = 'SUCCEEDED'. This module exposes a typed wrapper.

import type { PrismaClient } from '@contractor-ops/db';

export interface DedupKey {
  contractId: string;
  contentHash: string;
  modelVer: string;
}

/**
 * Returns the existing SUCCEEDED ContractHealthCheckRun row matching the dedup key,
 * or null if no row exists. Caller decides whether to short-circuit (force=false)
 * or continue and rely on the partial unique index to enforce dedup at INSERT time.
 */
export async function findExistingSucceededRun(
  db: PrismaClient,
  key: DedupKey,
): Promise<{ id: string } | null> {
  return db.contractHealthCheckRun.findFirst({
    where: {
      contractId: key.contractId,
      contentHash: key.contentHash,
      modelVer: key.modelVer,
      status: 'SUCCEEDED',
    },
    select: { id: true },
  });
}
