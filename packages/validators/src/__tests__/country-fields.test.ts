import { describe, expect, it } from 'vitest';
import {
  countryFieldsSchemaMap,
  deCountryFieldsSchema,
  deEntityTypeEnum,
  saudiCountryFieldsSchema,
  uaeCountryFieldsSchema,
  ukCountryFieldsSchema,
  ukEntityTypeEnum,
} from '../country-fields.js';

// ---------------------------------------------------------------------------
// Plan 02 (UK) + Plan 03 (DE) provide known-good validator fixtures.
// These vectors are stable checksummed values documented in the plan 02/03 tests.
// ---------------------------------------------------------------------------

const VALID_UTR = '5097172561';
const VALID_CH_NUMBER = '00000006';       // England/Wales 8-digit (Shell plc historically)
const VALID_CH_NUMBER_SCOT = 'SC000001';  // Scottish alphanumeric
const VALID_GB_VAT = 'GB123456782';       // post-2010 9755 checksum vector
const VALID_USTIDNR = 'DE136695976';       // BMW Group — canonical BMF test vector

// ---------------------------------------------------------------------------
// countryFieldsSchemaMap — existing entries untouched
// ---------------------------------------------------------------------------

describe('countryFieldsSchemaMap — preserves existing AE / SA entries', () => {
  it('AE still maps to uaeCountryFieldsSchema', () => {
    expect(countryFieldsSchemaMap.AE).toBe(uaeCountryFieldsSchema);
  });

  it('SA still maps to saudiCountryFieldsSchema', () => {
    expect(countryFieldsSchemaMap.SA).toBe(saudiCountryFieldsSchema);
  });

  it('GB maps to ukCountryFieldsSchema', () => {
    expect(countryFieldsSchemaMap.GB).toBe(ukCountryFieldsSchema);
  });

  it('DE maps to deCountryFieldsSchema', () => {
    expect(countryFieldsSchemaMap.DE).toBe(deCountryFieldsSchema);
  });
});

// ---------------------------------------------------------------------------
// Entity-type enums
// ---------------------------------------------------------------------------

describe('ukEntityTypeEnum', () => {
  it('accepts SOLE_TRADER, LTD, LLP', () => {
    expect(ukEntityTypeEnum.safeParse('SOLE_TRADER').success).toBe(true);
    expect(ukEntityTypeEnum.safeParse('LTD').success).toBe(true);
    expect(ukEntityTypeEnum.safeParse('LLP').success).toBe(true);
  });

  it('rejects unknown values', () => {
    expect(ukEntityTypeEnum.safeParse('PLC').success).toBe(false);
  });
});

describe('deEntityTypeEnum', () => {
  it('accepts all 7 DE entity types', () => {
    for (const t of ['EINZELUNTERNEHMEN', 'GBR', 'OHG', 'KG', 'UG', 'GMBH', 'AG']) {
      expect(deEntityTypeEnum.safeParse(t).success).toBe(true);
    }
  });

  it('rejects unknown values', () => {
    expect(deEntityTypeEnum.safeParse('KGaA').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UK schema — D-04 rules (UI-SPEC §Interaction 1 matrix)
// ---------------------------------------------------------------------------

describe('ukCountryFieldsSchema — D-04 required-field rules', () => {
  // SOLE_TRADER
  it('SOLE_TRADER without utr → fails on [utr] with required message', () => {
    const result = ukCountryFieldsSchema.safeParse({
      entityType: 'SOLE_TRADER',
      isVatRegistered: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const utrIssue = result.error.issues.find((i) => i.path[0] === 'utr');
      expect(utrIssue).toBeDefined();
      expect(utrIssue!.message).toBe('UTR is required for sole traders');
    }
  });

  it('SOLE_TRADER with valid UTR + no VAT → success', () => {
    const result = ukCountryFieldsSchema.safeParse({
      entityType: 'SOLE_TRADER',
      isVatRegistered: false,
      utr: VALID_UTR,
    });
    expect(result.success).toBe(true);
  });

  it('SOLE_TRADER with invalid UTR format → fails on [utr]', () => {
    const result = ukCountryFieldsSchema.safeParse({
      entityType: 'SOLE_TRADER',
      isVatRegistered: false,
      utr: '12345abc',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'utr')).toBe(true);
    }
  });

  // LTD
  it('LTD without companiesHouseNumber → fails on [companiesHouseNumber]', () => {
    const result = ukCountryFieldsSchema.safeParse({
      entityType: 'LTD',
      isVatRegistered: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path[0] === 'companiesHouseNumber',
      );
      expect(issue).toBeDefined();
      expect(issue!.message).toBe(
        'Companies House number is required for limited companies',
      );
    }
  });

  it('LTD with valid CH number, VAT-registered but missing vatRegistrationNumber → fails on [vatRegistrationNumber]', () => {
    const result = ukCountryFieldsSchema.safeParse({
      entityType: 'LTD',
      companiesHouseNumber: VALID_CH_NUMBER,
      isVatRegistered: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path[0] === 'vatRegistrationNumber'),
      ).toBe(true);
    }
  });

  it('LTD with valid CH number + valid VAT + VAT-registered → success', () => {
    const result = ukCountryFieldsSchema.safeParse({
      entityType: 'LTD',
      companiesHouseNumber: VALID_CH_NUMBER,
      isVatRegistered: true,
      vatRegistrationNumber: VALID_GB_VAT,
    });
    expect(result.success).toBe(true);
  });

  // LLP
  it('LLP with valid CH number, no VAT → success', () => {
    const result = ukCountryFieldsSchema.safeParse({
      entityType: 'LLP',
      companiesHouseNumber: VALID_CH_NUMBER_SCOT,
      isVatRegistered: false,
    });
    expect(result.success).toBe(true);
  });

  it('LLP without companiesHouseNumber → fails on [companiesHouseNumber]', () => {
    const result = ukCountryFieldsSchema.safeParse({
      entityType: 'LLP',
      isVatRegistered: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path[0] === 'companiesHouseNumber'),
      ).toBe(true);
    }
  });

  // Unknown entity type
  it('rejects unknown entityType value', () => {
    const result = ukCountryFieldsSchema.safeParse({
      entityType: 'PLC',
      isVatRegistered: false,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DE schema — D-04 rules
// ---------------------------------------------------------------------------

describe('deCountryFieldsSchema — D-04 required-field rules', () => {
  const baseEinzel = {
    bundesland: 'BW' as const,
    entityType: 'EINZELUNTERNEHMEN' as const,
    isVatRegistered: false,
    isKleinunternehmer: false,
  };

  // Steuernummer
  it('EINZELUNTERNEHMEN without steuernummer → fails on [steuernummer] with required message', () => {
    const result = deCountryFieldsSchema.safeParse(baseEinzel);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'steuernummer');
      expect(issue).toBeDefined();
      expect(issue!.message).toBe('Steuernummer is required');
    }
  });

  it('EINZELUNTERNEHMEN in BW with matching steuernummer → success', () => {
    const result = deCountryFieldsSchema.safeParse({
      ...baseEinzel,
      steuernummer: '93/815/08152',
    });
    expect(result.success).toBe(true);
  });

  it('EINZELUNTERNEHMEN in BW with Bayern-formatted steuernummer → fails with BW-specific message', () => {
    const result = deCountryFieldsSchema.safeParse({
      ...baseEinzel,
      steuernummer: '181/815/08155',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'steuernummer');
      expect(issue).toBeDefined();
      // Message must mention the Bundesland (either code or German name)
      expect(
        issue!.message.includes('BW') ||
          issue!.message.includes('Baden-Württemberg'),
      ).toBe(true);
    }
  });

  // Handelsregister
  it('GMBH without handelsregister → fails on [handelsregister]', () => {
    const result = deCountryFieldsSchema.safeParse({
      bundesland: 'BY',
      entityType: 'GMBH',
      isVatRegistered: false,
      isKleinunternehmer: false,
      steuernummer: '181/815/08155',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path[0] === 'handelsregister',
      );
      expect(issue).toBeDefined();
      expect(issue!.message).toBe(
        'Handelsregister is required for UG/GmbH entities',
      );
    }
  });

  it('UG without handelsregister → fails on [handelsregister]', () => {
    const result = deCountryFieldsSchema.safeParse({
      bundesland: 'BY',
      entityType: 'UG',
      isVatRegistered: false,
      isKleinunternehmer: false,
      steuernummer: '181/815/08155',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path[0] === 'handelsregister'),
      ).toBe(true);
    }
  });

  it('GMBH with valid handelsregister → success', () => {
    const result = deCountryFieldsSchema.safeParse({
      bundesland: 'BY',
      entityType: 'GMBH',
      isVatRegistered: false,
      isKleinunternehmer: false,
      steuernummer: '181/815/08155',
      handelsregister: {
        court: 'amtsgericht-muenchen',
        type: 'HRB',
        number: '123456',
      },
    });
    expect(result.success).toBe(true);
  });

  it('GMBH with unknown handelsregister court → fails on [handelsregister.court]', () => {
    const result = deCountryFieldsSchema.safeParse({
      bundesland: 'BY',
      entityType: 'GMBH',
      isVatRegistered: false,
      isKleinunternehmer: false,
      steuernummer: '181/815/08155',
      handelsregister: {
        court: 'amtsgericht-nonexistent',
        type: 'HRB',
        number: '123456',
      },
    });
    expect(result.success).toBe(false);
  });

  it('OHG without handelsregister → success (Handelsregister optional for OHG)', () => {
    const result = deCountryFieldsSchema.safeParse({
      bundesland: 'BY',
      entityType: 'OHG',
      isVatRegistered: false,
      isKleinunternehmer: false,
      steuernummer: '181/815/08155',
    });
    expect(result.success).toBe(true);
  });

  // USt-IdNr
  it('EINZELUNTERNEHMEN VAT-registered, not Kleinunternehmer, no ustIdNr → fails on [ustIdNr]', () => {
    const result = deCountryFieldsSchema.safeParse({
      bundesland: 'BY',
      entityType: 'EINZELUNTERNEHMEN',
      isVatRegistered: true,
      isKleinunternehmer: false,
      steuernummer: '181/815/08155',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'ustIdNr')).toBe(true);
    }
  });

  it('EINZELUNTERNEHMEN VAT-registered + Kleinunternehmer → success (exemption, no ustIdNr required)', () => {
    const result = deCountryFieldsSchema.safeParse({
      bundesland: 'BY',
      entityType: 'EINZELUNTERNEHMEN',
      isVatRegistered: true,
      isKleinunternehmer: true,
      steuernummer: '181/815/08155',
    });
    expect(result.success).toBe(true);
  });

  it('EINZELUNTERNEHMEN VAT-registered, not Kleinunternehmer, valid ustIdNr → success', () => {
    const result = deCountryFieldsSchema.safeParse({
      bundesland: 'BY',
      entityType: 'EINZELUNTERNEHMEN',
      isVatRegistered: true,
      isKleinunternehmer: false,
      steuernummer: '181/815/08155',
      ustIdNr: VALID_USTIDNR,
    });
    expect(result.success).toBe(true);
  });

  it('EINZELUNTERNEHMEN with invalid ustIdNr format → fails on [ustIdNr]', () => {
    const result = deCountryFieldsSchema.safeParse({
      bundesland: 'BY',
      entityType: 'EINZELUNTERNEHMEN',
      isVatRegistered: true,
      isKleinunternehmer: false,
      steuernummer: '181/815/08155',
      ustIdNr: 'DE000000000',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'ustIdNr')).toBe(true);
    }
  });

  // Bundesland-specific Steuernummer dispatch
  it('NRW steuernummer 4+4 format is accepted in NW but not in BW', () => {
    const nwResult = deCountryFieldsSchema.safeParse({
      bundesland: 'NW',
      entityType: 'EINZELUNTERNEHMEN',
      isVatRegistered: false,
      isKleinunternehmer: false,
      steuernummer: '133/8150/8159',
    });
    expect(nwResult.success).toBe(true);

    const bwResult = deCountryFieldsSchema.safeParse({
      bundesland: 'BW',
      entityType: 'EINZELUNTERNEHMEN',
      isVatRegistered: false,
      isKleinunternehmer: false,
      steuernummer: '133/8150/8159',
    });
    expect(bwResult.success).toBe(false);
  });

  // Unknown Bundesland
  it('rejects unknown bundesland code', () => {
    const result = deCountryFieldsSchema.safeParse({
      bundesland: 'ZZ',
      entityType: 'EINZELUNTERNEHMEN',
      isVatRegistered: false,
      isKleinunternehmer: false,
      steuernummer: '93/815/08152',
    });
    expect(result.success).toBe(false);
  });

  // Handelsregister number format
  it('GMBH handelsregister with non-digit number → fails', () => {
    const result = deCountryFieldsSchema.safeParse({
      bundesland: 'BY',
      entityType: 'GMBH',
      isVatRegistered: false,
      isKleinunternehmer: false,
      steuernummer: '181/815/08155',
      handelsregister: {
        court: 'amtsgericht-muenchen',
        type: 'HRB',
        number: 'ABC123',
      },
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Schema-level integration through countryFieldsSchemaMap
// ---------------------------------------------------------------------------

describe('countryFieldsSchemaMap dispatch', () => {
  it('GB dispatch uses ukCountryFieldsSchema rules', () => {
    const result = countryFieldsSchemaMap.GB!.safeParse({
      entityType: 'SOLE_TRADER',
      isVatRegistered: false,
    });
    expect(result.success).toBe(false);
  });

  it('DE dispatch uses deCountryFieldsSchema rules', () => {
    const result = countryFieldsSchemaMap.DE!.safeParse({
      bundesland: 'BW',
      entityType: 'EINZELUNTERNEHMEN',
      isVatRegistered: false,
      isKleinunternehmer: false,
    });
    expect(result.success).toBe(false);
  });
});
