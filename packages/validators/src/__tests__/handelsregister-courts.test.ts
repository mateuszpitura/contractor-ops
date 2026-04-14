import { describe, expect, it } from 'vitest';

import { HANDELSREGISTER_COURTS } from '../handelsregister-courts.js';

describe('HANDELSREGISTER_COURTS', () => {
  it('has no duplicate court codes', () => {
    const codes = HANDELSREGISTER_COURTS.map((c) => c.code);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });

  it('every entry has non-empty code, name, state, and city', () => {
    for (const court of HANDELSREGISTER_COURTS) {
      expect(court.code, `code missing on entry with name="${court.name}"`).toBeTruthy();
      expect(court.name, `name missing on entry with code="${court.code}"`).toBeTruthy();
      expect(court.state, `state missing on entry with code="${court.code}"`).toBeTruthy();
      expect(court.city, `city missing on entry with code="${court.code}"`).toBeTruthy();
    }
  });

  it('contains at least 16 entries (one per Bundesland minimum)', () => {
    expect(HANDELSREGISTER_COURTS.length).toBeGreaterThanOrEqual(16);
  });
});
