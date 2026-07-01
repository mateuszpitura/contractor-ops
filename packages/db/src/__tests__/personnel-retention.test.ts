/**
 * RED scaffold — personnel-file retention resolver.
 *
 * Pins the locked per-jurisdiction retention math BEFORE the resolver exists.
 * Terminal-RED via the missing `getPersonnelRetentionCutoff` export on the
 * shared retention primitive (`../retention-policy.ts`) — the personnel-file
 * rules extend that same map (one engine, three deletion chokepoints), so the
 * resolver lands here rather than in a parallel module. A later wave turns this
 * GREEN; the test directory is excluded from tsc, so the missing export does
 * not brick the package typecheck.
 *
 * Locked behavior encoded:
 *   - per-rule event-typed anchor (HIRE_DATE | TERMINATION_DATE | DOCUMENT_DATE)
 *   - retainUntil = anchorDate + years; erasable only when now >= retainUntil
 *   - US I-9 max(HIRE+3y, TERMINATION+1y) returns the LATER cutoff (8 CFR 274a.2)
 *   - active employee (terminationDate null) with a TERMINATION_DATE rule →
 *     retained indefinitely (retainUntil null, erasable false)
 *   - if ANY rule in a section is indefinite, the whole section is indefinite
 */

import { describe, expect, it } from 'vitest';
// The resolver does not exist yet — this import is the terminal-RED anchor.
import { getPersonnelRetentionCutoff } from '../retention-policy.js';

type RetentionAnchor = 'HIRE_DATE' | 'TERMINATION_DATE' | 'DOCUMENT_DATE';

interface PersonnelRetentionRuleFixture {
  recordType: string;
  anchor: RetentionAnchor;
  years: number;
  citation: string;
}

function addYears(date: Date, years: number): Date {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

const PL_GENERAL: PersonnelRetentionRuleFixture = {
  recordType: 'pl-personnelfile-general',
  anchor: 'TERMINATION_DATE',
  years: 10,
  citation: 'KP art. 94(9b) — 10-year post-2019 personnel-file retention',
};

const DE_TAX: PersonnelRetentionRuleFixture = {
  recordType: 'de-personalakte-tax',
  anchor: 'TERMINATION_DATE',
  years: 10,
  citation: '§ 147 AO / § 257 HGB — 10-year tax/commercial record retention',
};

const DE_ACCIDENT: PersonnelRetentionRuleFixture = {
  recordType: 'de-accident-records',
  anchor: 'DOCUMENT_DATE',
  years: 30,
  citation: '§ 24 Abs. 6 ArbMedVV / DGUV — 30-year accident-record retention',
};

const UK_GENERAL: PersonnelRetentionRuleFixture = {
  recordType: 'uk-personnel-general',
  anchor: 'TERMINATION_DATE',
  years: 6,
  citation: 'UK Limitation Act 1980 — 6-year general personnel retention',
};

const UK_FINANCIAL: PersonnelRetentionRuleFixture = {
  recordType: 'uk-personnel-financial',
  anchor: 'TERMINATION_DATE',
  years: 7,
  citation: 'HMRC — 7-year payroll/financial record retention',
};

const US_I9_POST_HIRE: PersonnelRetentionRuleFixture = {
  recordType: 'us-i9-post-hire',
  anchor: 'HIRE_DATE',
  years: 3,
  citation: '8 CFR 274a.2(b)(2)(i)(A) — I-9 3 years after hire',
};

const US_I9_POST_TERMINATION: PersonnelRetentionRuleFixture = {
  recordType: 'us-i9-post-termination',
  anchor: 'TERMINATION_DATE',
  years: 1,
  citation: '8 CFR 274a.2(b)(2)(i)(A) — I-9 1 year after termination',
};

describe('getPersonnelRetentionCutoff — PL post-2019 (TERMINATION_DATE + 10y)', () => {
  const terminationDate = new Date('2020-06-01T00:00:00.000Z');
  const expectedRetainUntil = addYears(terminationDate, 10); // 2030-06-01

  it('retainUntil = terminationDate + 10y', () => {
    const result = getPersonnelRetentionCutoff([PL_GENERAL], {
      hireDate: new Date('2015-01-01T00:00:00.000Z'),
      terminationDate,
      documentDate: new Date('2019-03-01T00:00:00.000Z'),
      now: new Date('2031-01-01T00:00:00.000Z'),
    });
    expect(result.retainUntil?.getTime()).toBe(expectedRetainUntil.getTime());
    expect(result.citation).toBe(PL_GENERAL.citation);
  });

  it('erasable is false while now < retainUntil', () => {
    const result = getPersonnelRetentionCutoff([PL_GENERAL], {
      hireDate: new Date('2015-01-01T00:00:00.000Z'),
      terminationDate,
      documentDate: null,
      now: new Date('2029-06-01T00:00:00.000Z'),
    });
    expect(result.erasable).toBe(false);
  });

  it('erasable is true once now >= retainUntil', () => {
    const result = getPersonnelRetentionCutoff([PL_GENERAL], {
      hireDate: new Date('2015-01-01T00:00:00.000Z'),
      terminationDate,
      documentDate: null,
      now: new Date('2030-06-02T00:00:00.000Z'),
    });
    expect(result.erasable).toBe(true);
  });
});

describe('getPersonnelRetentionCutoff — DE (tax 10y / accident 30y)', () => {
  it('de-personalakte-tax = terminationDate + 10y', () => {
    const terminationDate = new Date('2022-01-01T00:00:00.000Z');
    const result = getPersonnelRetentionCutoff([DE_TAX], {
      hireDate: new Date('2010-01-01T00:00:00.000Z'),
      terminationDate,
      documentDate: null,
      now: new Date('2020-01-01T00:00:00.000Z'),
    });
    expect(result.retainUntil?.getTime()).toBe(addYears(terminationDate, 10).getTime());
  });

  it('de-accident-records = documentDate + 30y', () => {
    const documentDate = new Date('2000-05-10T00:00:00.000Z');
    const result = getPersonnelRetentionCutoff([DE_ACCIDENT], {
      hireDate: new Date('1998-01-01T00:00:00.000Z'),
      terminationDate: new Date('2005-01-01T00:00:00.000Z'),
      documentDate,
      now: new Date('2020-01-01T00:00:00.000Z'),
    });
    expect(result.retainUntil?.getTime()).toBe(addYears(documentDate, 30).getTime());
  });
});

describe('getPersonnelRetentionCutoff — UK (general 6y / financial 7y)', () => {
  const terminationDate = new Date('2021-03-15T00:00:00.000Z');

  it('uk-personnel-general = terminationDate + 6y', () => {
    const result = getPersonnelRetentionCutoff([UK_GENERAL], {
      hireDate: new Date('2015-01-01T00:00:00.000Z'),
      terminationDate,
      documentDate: null,
      now: new Date('2022-01-01T00:00:00.000Z'),
    });
    expect(result.retainUntil?.getTime()).toBe(addYears(terminationDate, 6).getTime());
  });

  it('uk-personnel-financial = terminationDate + 7y', () => {
    const result = getPersonnelRetentionCutoff([UK_FINANCIAL], {
      hireDate: new Date('2015-01-01T00:00:00.000Z'),
      terminationDate,
      documentDate: null,
      now: new Date('2022-01-01T00:00:00.000Z'),
    });
    expect(result.retainUntil?.getTime()).toBe(addYears(terminationDate, 7).getTime());
  });
});

describe('getPersonnelRetentionCutoff — US I-9 max(HIRE+3y, TERMINATION+1y)', () => {
  it('returns the LATER cutoff when TERMINATION+1y wins', () => {
    const hireDate = new Date('2020-01-01T00:00:00.000Z'); // +3y = 2023-01-01
    const terminationDate = new Date('2024-06-01T00:00:00.000Z'); // +1y = 2025-06-01 (later)
    const result = getPersonnelRetentionCutoff([US_I9_POST_HIRE, US_I9_POST_TERMINATION], {
      hireDate,
      terminationDate,
      documentDate: null,
      now: new Date('2024-07-01T00:00:00.000Z'),
    });
    expect(result.retainUntil?.getTime()).toBe(addYears(terminationDate, 1).getTime());
    expect(result.erasable).toBe(false);
  });

  it('returns the LATER cutoff when HIRE+3y wins', () => {
    const hireDate = new Date('2020-01-01T00:00:00.000Z'); // +3y = 2023-01-01 (later)
    const terminationDate = new Date('2021-06-01T00:00:00.000Z'); // +1y = 2022-06-01
    const result = getPersonnelRetentionCutoff([US_I9_POST_HIRE, US_I9_POST_TERMINATION], {
      hireDate,
      terminationDate,
      documentDate: null,
      now: new Date('2024-01-01T00:00:00.000Z'),
    });
    expect(result.retainUntil?.getTime()).toBe(addYears(hireDate, 3).getTime());
    expect(result.erasable).toBe(true);
  });
});

describe('getPersonnelRetentionCutoff — active employee retained indefinitely', () => {
  it('terminationDate null + a TERMINATION_DATE rule → retainUntil null, erasable false', () => {
    const result = getPersonnelRetentionCutoff([PL_GENERAL], {
      hireDate: new Date('2015-01-01T00:00:00.000Z'),
      terminationDate: null,
      documentDate: null,
      now: new Date('2099-01-01T00:00:00.000Z'),
    });
    expect(result.retainUntil).toBeNull();
    expect(result.erasable).toBe(false);
  });

  it('if ANY rule in the section is indefinite, the whole section is indefinite', () => {
    // us-i9-post-hire resolves (HIRE_DATE known) but us-i9-post-termination is
    // indefinite while active — the section must be treated as indefinite.
    const result = getPersonnelRetentionCutoff([US_I9_POST_HIRE, US_I9_POST_TERMINATION], {
      hireDate: new Date('2015-01-01T00:00:00.000Z'),
      terminationDate: null,
      documentDate: null,
      now: new Date('2099-01-01T00:00:00.000Z'),
    });
    expect(result.retainUntil).toBeNull();
    expect(result.erasable).toBe(false);
  });
});
