import { describe, it } from 'vitest';

describe('POST /api/idp-deprovisioning/_step-runner (Phase 76 D-03)', () => {
  it.todo('verifies QStash signature; rejects unsigned/invalid');
  it.todo('inserts IdpChangeProvenance row BEFORE adapter call');
  it.todo('short-circuits to FAILED when step.attempts >= MAX_ATTEMPTS');
  it.todo('updates step.requestSha256 + step.responseSha256 with canonicalised hashes');
  it.todo('calls recomputeRunStatus after every step transition');
  it.todo('emits getIdpAuditLogger entry with full audit fields');
});
