import { describe, it } from 'vitest';

describe('gcExpiredProvenance (Phase 76 D-12)', () => {
  it.todo('deletes rows where initiatedAt < now - 90d');
  it.todo('does not delete rows within the 90-day window');
  it.todo('idempotent — second run within an hour returns deleted: 0');
});
