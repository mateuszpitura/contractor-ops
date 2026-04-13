import { describe, expect, it } from 'vitest';
import type { HandelsregisterCourt } from '../handelsregister-courts.js';
import { HANDELSREGISTER_COURTS } from '../handelsregister-courts.js';
import type { BundeslandCode } from '../steuernummer-formats.js';
import {
  getSteuernummerFormat,
  getSteuernummerRegex,
  STEUERNUMMER_FORMATS,
} from '../steuernummer-formats.js';

// ---------------------------------------------------------------------------
// STEUERNUMMER_FORMATS
// ---------------------------------------------------------------------------

const ALL_BUNDESLAND_CODES: readonly BundeslandCode[] = [
  'BW',
  'BY',
  'BE',
  'BB',
  'HB',
  'HH',
  'HE',
  'MV',
  'NI',
  'NW',
  'RP',
  'SL',
  'SN',
  'ST',
  'SH',
  'TH',
] as const;

describe('STEUERNUMMER_FORMATS', () => {
  it('has exactly 16 entries (one per Bundesland)', () => {
    expect(STEUERNUMMER_FORMATS).toHaveLength(16);
  });

  it('covers every Bundesland code with a unique entry', () => {
    const codes = STEUERNUMMER_FORMATS.map(f => f.code);
    expect(new Set(codes).size).toBe(16);
    for (const expected of ALL_BUNDESLAND_CODES) {
      expect(codes).toContain(expected);
    }
  });

  it.each(
    ALL_BUNDESLAND_CODES,
  )('%s: regex matches its own example (slash-separated form)', code => {
    const entry = STEUERNUMMER_FORMATS.find(f => f.code === code);
    expect(entry).toBeDefined();
    expect(entry?.regex.test(entry?.example)).toBe(true);
  });

  it.each(ALL_BUNDESLAND_CODES)('%s: regex matches its example with slashes removed', code => {
    const entry = STEUERNUMMER_FORMATS.find(f => f.code === code);
    expect(entry).toBeDefined();
    expect(entry?.regex.test(entry?.example.replace(/\//g, ''))).toBe(true);
  });

  it('every entry has non-empty germanName', () => {
    for (const entry of STEUERNUMMER_FORMATS) {
      expect(entry.germanName.length).toBeGreaterThan(0);
    }
  });

  it('length is either 10 or 11 for every entry', () => {
    for (const entry of STEUERNUMMER_FORMATS) {
      expect([10, 11]).toContain(entry.length);
    }
  });
});

describe('getSteuernummerFormat', () => {
  it('returns the BW entry with the expected example', () => {
    expect(getSteuernummerFormat('BW').example).toBe('93/815/08152');
  });

  it('returns the Bayern entry', () => {
    const f = getSteuernummerFormat('BY');
    expect(f.germanName).toBe('Bayern');
    expect(f.length).toBe(11);
  });

  it('throws on unknown Bundesland code', () => {
    expect(() => getSteuernummerFormat('ZZ' as never)).toThrow('Unknown Bundesland: ZZ');
  });
});

describe('getSteuernummerRegex', () => {
  it('returns the regex from the format entry', () => {
    const rx = getSteuernummerRegex('BW');
    expect(rx).toBeInstanceOf(RegExp);
    expect(rx.test('93/815/08152')).toBe(true);
  });

  it('NRW regex matches the NRW-style 4+4 example', () => {
    const rx = getSteuernummerRegex('NW');
    expect(rx.test('133/8150/8159')).toBe(true);
    // Reject a BY-style format for NRW
    expect(rx.test('181/815/08155')).toBe(false);
  });

  it('Hessen regex enforces leading 0 triplet', () => {
    const rx = getSteuernummerRegex('HE');
    expect(rx.test('013/815/08153')).toBe(true);
    expect(rx.test('113/815/08153')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// HANDELSREGISTER_COURTS
// ---------------------------------------------------------------------------

describe('HANDELSREGISTER_COURTS', () => {
  it('contains at least 100 entries', () => {
    expect(HANDELSREGISTER_COURTS.length).toBeGreaterThanOrEqual(100);
  });

  it('has no duplicate codes', () => {
    const codes = HANDELSREGISTER_COURTS.map(c => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('every court has non-empty code/name/state/city', () => {
    for (const court of HANDELSREGISTER_COURTS) {
      expect(court.code.length).toBeGreaterThan(0);
      expect(court.name.length).toBeGreaterThan(0);
      expect(court.state.length).toBeGreaterThan(0);
      expect(court.city.length).toBeGreaterThan(0);
    }
  });

  it('every court name starts with "Amtsgericht "', () => {
    for (const court of HANDELSREGISTER_COURTS) {
      expect(court.name.startsWith('Amtsgericht ')).toBe(true);
    }
  });

  it('every state is a valid BundeslandCode', () => {
    for (const court of HANDELSREGISTER_COURTS) {
      expect(ALL_BUNDESLAND_CODES).toContain(court.state as BundeslandCode);
    }
  });

  it('every Bundesland has at least one court', () => {
    const states = new Set(HANDELSREGISTER_COURTS.map(c => c.state));
    expect(states.size).toBe(16);
    for (const code of ALL_BUNDESLAND_CODES) {
      expect(states.has(code)).toBe(true);
    }
  });

  it('uses slug-style codes (lowercase, hyphen-separated, no umlauts)', () => {
    const slugPattern = /^[a-z0-9-]+$/;
    for (const court of HANDELSREGISTER_COURTS) {
      expect(court.code).toMatch(slugPattern);
    }
  });

  it('is typed as readonly HandelsregisterCourt[]', () => {
    // Type-only assertion: array shape should include expected keys
    const first: HandelsregisterCourt = HANDELSREGISTER_COURTS[0]!;
    expect(first).toHaveProperty('code');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('state');
    expect(first).toHaveProperty('city');
  });
});
