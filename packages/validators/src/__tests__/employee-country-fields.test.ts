// Per-market employee country-fields registry (mirrors the contractor
// countryFields dispatch idiom, parallel map — not a fork).
//
// RED until `packages/validators/src/employee-country-fields.ts` is created
// exporting `validateEmployeeCountryFields` + `employeeCountryFieldsSchemaMap`.
// The import resolves to a not-yet-existing module so the suite fails at module
// resolution (Cannot find module).
//
// Boundary invariant pinned here: national-person identifiers (PESEL, SSN,
// Iqama, Emirates ID) live ONLY in dedicated encrypted columns and must NEVER
// be accepted into the countryFields JSON, which is returned wholesale on read.

import { describe, expect, it } from 'vitest';

import {
  employeeCountryFieldsSchemaMap,
  validateEmployeeCountryFields,
} from '../employee-country-fields.js';

// ---------------------------------------------------------------------------
// Dispatch — unknown country code returns an empty object (no schema)
// ---------------------------------------------------------------------------

describe('validateEmployeeCountryFields dispatch', () => {
  it('returns {} for an unknown country code', () => {
    expect(validateEmployeeCountryFields('ZZ', { anything: true })).toEqual({});
  });

  it('exposes a schema for each of the six supported markets', () => {
    for (const code of ['PL', 'DE', 'GB', 'US', 'AE', 'SA']) {
      expect(employeeCountryFieldsSchemaMap[code]).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Minimal valid field objects parse per market
// ---------------------------------------------------------------------------

describe('validateEmployeeCountryFields — minimal valid payloads', () => {
  it('parses a minimal valid PL field object', () => {
    expect(() =>
      validateEmployeeCountryFields('PL', { stanowisko: 'Programista', etat: '1.00' }),
    ).not.toThrow();
  });

  it('parses a minimal valid DE field object', () => {
    expect(() =>
      validateEmployeeCountryFields('DE', { lohnsteuerklasse: 'I', kirchensteuer: false }),
    ).not.toThrow();
  });

  it('parses a minimal valid GB field object', () => {
    expect(() =>
      validateEmployeeCountryFields('GB', { taxCode: '1257L', studentLoanPlan: 'NONE' }),
    ).not.toThrow();
  });

  it('parses a minimal valid US field object', () => {
    expect(() =>
      validateEmployeeCountryFields('US', { filingStatus: 'SINGLE', stateWithholding: 'CA' }),
    ).not.toThrow();
  });

  it('parses a minimal valid AE field object', () => {
    expect(() => validateEmployeeCountryFields('AE', { visaType: 'EMPLOYMENT' })).not.toThrow();
  });

  it('parses a minimal valid SA field object', () => {
    expect(() =>
      validateEmployeeCountryFields('SA', { saudizationCategory: 'GREEN' }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Missing required field is rejected
// ---------------------------------------------------------------------------

describe('validateEmployeeCountryFields — required-field enforcement', () => {
  it('rejects a PL payload missing its required job-title field', () => {
    expect(() => validateEmployeeCountryFields('PL', { etat: '1.00' })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// PII boundary — no national-ID key may enter the countryFields JSON schema.
// The encrypted IDs live in dedicated columns only; allowing them here would
// leak them through the wholesale countryFields read.
// ---------------------------------------------------------------------------

describe('validateEmployeeCountryFields — national-ID keys are never accepted into JSON', () => {
  const NATIONAL_ID_PAYLOADS: Array<[string, Record<string, unknown>]> = [
    ['PL', { stanowisko: 'Programista', etat: '1.00', pesel: '44051401359' }],
    ['US', { filingStatus: 'SINGLE', stateWithholding: 'CA', ssn: '078051120' }],
    ['SA', { saudizationCategory: 'GREEN', iqama: '2000000004' }],
    ['AE', { visaType: 'EMPLOYMENT', emiratesId: '784-1990-1234567-1' }],
  ];

  it.each(
    NATIONAL_ID_PAYLOADS,
  )('strips or rejects the national-ID key for %s (never round-trips it into the JSON)', (code, payload) => {
    const idKey = Object.keys(payload).find(k =>
      ['pesel', 'ssn', 'iqama', 'emiratesId', 'nationalId'].includes(k),
    ) as string;
    let parsed: Record<string, unknown> | undefined;
    try {
      parsed = validateEmployeeCountryFields(code, payload);
    } catch {
      // A strict schema rejecting the unknown national-ID key also satisfies
      // the invariant — the key never reaches the stored JSON either way.
      return;
    }
    expect(parsed).not.toHaveProperty(idKey);
  });
});
