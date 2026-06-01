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

  it('Asia/Riyadh (no DST): boundary = startOfDay(endedAt+14d) at 00:00 KSA local', () => {
    // endedAt = 13:00 Asia/Riyadh on 2026-04-12 (UTC+3, no DST).
    // endedAt + 14d (raw) = 2026-04-26T10:00Z = 13:00 Riyadh on 2026-04-26.
    // startOfDay(that day in Riyadh) = 2026-04-26 00:00 Riyadh = 2026-04-25T21:00:00Z.
    const endedAt = new Date('2026-04-12T10:00:00Z');
    const boundaryUtc = '2026-04-25T21:00:00.000Z';
    const decision = canStartDeprovisioning({
      endedAt,
      jurisdictionTz: 'Asia/Riyadh',
      status: 'ENDED',
      now: new Date('2026-04-25T20:59:00Z'),
    });
    expect(decision.allowed).toBe(false);
    expect(decision.earliestDate?.toISOString()).toBe(boundaryUtc);
    expect(
      canStartDeprovisioning({
        endedAt,
        jurisdictionTz: 'Asia/Riyadh',
        status: 'ENDED',
        now: new Date('2026-04-25T21:01:00Z'),
      }).allowed,
    ).toBe(true);
  });

  it('Europe/Berlin DST transition (March 2026): boundary respects local DST shift', () => {
    // endedAt = 23:00 Europe/Berlin on 2026-03-15 (CET, UTC+1).
    // endedAt + 14d (raw) = 2026-03-29T22:00Z. Berlin switches to CEST (UTC+2) at
    // 02:00 local on 2026-03-29, so 22:00Z = 00:00 Berlin on 2026-03-30.
    // startOfDay(that, Berlin) = 2026-03-30 00:00 CEST = 2026-03-29T22:00:00Z.
    const endedAt = new Date('2026-03-15T22:00:00Z');
    const boundaryUtc = '2026-03-29T22:00:00.000Z';
    const before = canStartDeprovisioning({
      endedAt,
      jurisdictionTz: 'Europe/Berlin',
      status: 'ENDED',
      now: new Date('2026-03-29T21:59:00Z'),
    });
    expect(before.allowed).toBe(false);
    expect(before.earliestDate?.toISOString()).toBe(boundaryUtc);
    expect(
      canStartDeprovisioning({
        endedAt,
        jurisdictionTz: 'Europe/Berlin',
        status: 'ENDED',
        now: new Date('2026-03-29T22:01:00Z'),
      }).allowed,
    ).toBe(true);
  });

  it('Asia/Riyadh: reason string shows the LOCAL date, not the previous UTC day', () => {
    // endedAt = 2026-05-01T00:00:00Z. +14d raw = 2026-05-15T00:00:00Z.
    // startOfDay in Asia/Riyadh (+03) = 2026-05-14T21:00:00Z (= 2026-05-15 00:00 Riyadh).
    // UTC ISO of that instant .slice(0,10) = "2026-05-14" (WRONG — off-by-one bug).
    // TZ-aware format(new TZDate(..., 'Asia/Riyadh'), 'yyyy-MM-dd') = "2026-05-15" (CORRECT).
    const endedAt = new Date('2026-05-01T00:00:00Z');
    const decision = canStartDeprovisioning({
      endedAt,
      jurisdictionTz: 'Asia/Riyadh',
      status: 'ENDED',
      now: new Date('2026-05-14T20:59:00Z'), // 1 min before Riyadh boundary (2026-05-14T21:00Z)
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('2026-05-15');
    expect(decision.reason).not.toContain('2026-05-14');
  });

  it('Asia/Dubai: reason string shows the LOCAL date, not the previous UTC day', () => {
    // Dubai is UTC+4. Boundary = 2026-05-14T20:00:00Z (= 2026-05-15 00:00 Dubai).
    // UTC ISO slice = "2026-05-14" (WRONG); TZ-aware format = "2026-05-15" (CORRECT).
    const endedAt = new Date('2026-05-01T00:00:00Z');
    const decision = canStartDeprovisioning({
      endedAt,
      jurisdictionTz: 'Asia/Dubai',
      status: 'ENDED',
      now: new Date('2026-05-14T19:59:00Z'), // 1 min before Dubai boundary (2026-05-14T20:00Z)
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('2026-05-15');
    expect(decision.reason).not.toContain('2026-05-14');
  });

  it('earliestDate is computed even when allowed=true (UI can display the passed boundary)', () => {
    const endedAt = new Date('2026-04-01T10:00:00Z');
    const now = new Date('2026-04-16T10:00:00Z');
    const decision = canStartDeprovisioning({
      endedAt,
      jurisdictionTz: 'Europe/Berlin',
      status: 'ENDED',
      now,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.earliestDate).toBeInstanceOf(Date);
  });
});
