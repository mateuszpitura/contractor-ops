import { describe, it } from 'vitest';

describe('provenanceLookup (Phase 76 D-10)', () => {
  it.todo('returns null when no row matches (provider, externalUserId, actionKind, 1h window)');
  it.todo('returns { id } and atomically sets matchedAt when a row matches');
  it.todo('returns null on lost-race (concurrent webhook claims first)');
  it.todo('respects 1-hour window — older rows are not matched');
  it.todo('returns null for already-matched rows (matchedAt IS NOT NULL)');
});

describe('insertProvenance (Phase 76 D-09)', () => {
  it.todo('inserts a row with initiatedAt = now() and matchedAt = null');
  it.todo('returns the inserted row id');
});
