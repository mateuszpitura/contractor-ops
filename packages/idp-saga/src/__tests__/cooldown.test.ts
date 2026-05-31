import { describe, expect, it } from 'vitest';
import { canStartDeprovisioning } from '../cooldown';

describe('canStartDeprovisioning (Phase 76 D-05/D-06)', () => {
  it('blocks deprovisioning when endedAt was 10 days ago in Europe/Berlin (cooldown active)', () => {
    const endedAt = new Date('2026-04-16T22:00:00Z');
    const now = new Date('2026-04-26T08:00:00Z');
    const decision = canStartDeprovisioning({
      endedAt,
      jurisdictionTz: 'Europe/Berlin',
      status: 'ENDED',
      now,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/14-day cooldown active/);
    expect(decision.earliestDate).toBeInstanceOf(Date);
  });

  it('allows deprovisioning 15 days after endedAt (cooldown elapsed)', () => {
    const endedAt = new Date('2026-04-01T10:00:00Z');
    const now = new Date('2026-04-16T10:00:00Z');
    const decision = canStartDeprovisioning({
      endedAt,
      jurisdictionTz: 'Europe/Berlin',
      status: 'ENDED',
      now,
    });
    expect(decision.allowed).toBe(true);
  });

  it('refuses when assignment is not ENDED', () => {
    const decision = canStartDeprovisioning({
      endedAt: null,
      jurisdictionTz: 'Europe/Berlin',
      status: 'ACTIVE',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/not ENDED/i);
  });

  it('refuses when endedAt is null on an ENDED assignment (legacy data)', () => {
    const decision = canStartDeprovisioning({
      endedAt: null,
      jurisdictionTz: 'Europe/Berlin',
      status: 'ENDED',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/endedAt|missing/i);
  });
});
