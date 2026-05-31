import { describe, it } from 'vitest';

describe('runContractHealthCheck — idempotency dedup (Phase 75 D-03)', () => {
  it.todo('first run for a contract creates a SUCCEEDED ContractHealthCheckRun');
  it.todo(
    're-run with same (contractId, contentHash, modelVer) returns the existing row (no insert)',
  );
  it.todo('re-run with force: true creates a fresh row even when (contentHash, modelVer) matches');
  it.todo(
    'partial-unique-index enforces dedup ONLY when status = SUCCEEDED (FAILED runs do not block re-runs)',
  );
  it.todo('different modelVer with same contentHash creates a new row (model bump pathway)');
  it.todo('different contentHash with same modelVer creates a new row (re-uploaded PDF pathway)');
});
