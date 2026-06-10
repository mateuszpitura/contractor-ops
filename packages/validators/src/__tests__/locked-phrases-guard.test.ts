// Phase 56 · Plan 03 — CI guard for locked German legal phrases (FOUND-04, D-05/D-06).
// See .planning/phases/56-country-foundations-german-i18n/56-03-PLAN.md.
//
// Enforces (per phase CONTEXT D-05, D-06, D-07):
//   1. No reserved legal key appears in any locale messages/*.json file.
//   2. Every value in LOCKED_DE_PHRASES appears verbatim in
//      packages/validators/src/privacy-notices/de.ts once Plan 07 lands.
//   3. messages/de.json uses the formal "Sie" register (no Du/Dir/Dein…).
//
// Gating: the reserved-key iteration always runs for en/pl/ar/de (missing
// files are skipped to keep the guard idempotent pre- vs post-Plan 05/07).

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { LOCKED_AE_PHRASES, RESERVED_AE_LEGAL_KEYS } from '../legal/ae.js';
import {
  EINVOICE_INTAKE_EXTENDED_BEST_EFFORT_DE,
  EINVOICE_INTAKE_LEVEL_TOO_LOW_DE,
  EINVOICE_INTAKE_XSD_REJECT_DE,
  LOCKED_DE_PHRASES,
  RESERVED_LEGAL_KEYS,
  SKONTO_DESCRIPTION_TEMPLATE_DE,
} from '../legal/de.js';
import {
  BANNER_IR35_ADVISORY_EN,
  BANNER_SCHEIN_ADVISORY_DE,
  DRV_UNVERIFIED_ENTRY_DISCLAIMER_DE,
  LOCKED_DISCLAIMERS,
  RESERVED_DISCLAIMER_KEYS,
  SDS_APPROVAL_STATEMENT_EN,
  SOFTWARE_NOT_LEGAL_ADVICE_EN,
} from '../legal/disclaimers.js';
import { LOCKED_EN_PHRASES, RESERVED_EN_LEGAL_KEYS } from '../legal/en.js';
import {
  LOCKED_GB_PHRASES,
  LPCDA_CLAIM_FOOTER,
  LPCDA_COMPENSATION_LABEL,
  LPCDA_SECTION_REF,
  LPCDA_STATUTORY_RATE_LABEL,
  RESERVED_GB_LEGAL_KEYS,
} from '../legal/gb.js';
import { LOCKED_SA_PHRASES, RESERVED_SA_LEGAL_KEYS } from '../legal/sa.js';
import { getAllPending, getRegistry, isAllApproved } from '../legal/signoff-registry.js';
import rawRegistry from '../legal/signoff-registry.json' with { type: 'json' };
import { SignoffRegistrySchema } from '../legal/signoff-registry-schema.js';

const messagesDir = path.resolve(__dirname, '../../../../apps/web-vite/messages');
const locales = ['en', 'pl', 'ar', 'de'] as const;

function loadMessages(locale: string): Record<string, unknown> | null {
  const filePath = path.join(messagesDir, `${locale}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
}

function flatKeys(obj: unknown, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    v !== null && typeof v === 'object' ? flatKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('Locked German legal phrases (D-05, D-06)', () => {
  it.each(locales)('messages/%s.json does not define any reserved legal key', locale => {
    const messages = loadMessages(locale);
    if (messages === null) return; // locale file not yet created (Plan 05 adds de.json)

    const keys = flatKeys(messages);
    const reserved = [
      ...RESERVED_LEGAL_KEYS,
      ...RESERVED_EN_LEGAL_KEYS,
      ...RESERVED_GB_LEGAL_KEYS,
      ...RESERVED_AE_LEGAL_KEYS,
      ...RESERVED_SA_LEGAL_KEYS,
    ];
    const violations = keys.filter(k => reserved.some(r => k === r || k.endsWith(`.${r}`)));
    expect(
      violations,
      `Reserved legal keys leaked into ${locale}.json: ${violations.join(', ')}`,
    ).toEqual([]);
  });

  it('privacy-notices/de.ts content contains every locked phrase (output-level D-06)', async () => {
    // TODO Plan 07 — privacy-notices/de.ts is created there. Skip until it exists.
    const privacyDePath = path.resolve(__dirname, '../privacy-notices/de.ts');
    if (!fs.existsSync(privacyDePath)) return;

    const dePrivacy = await import('../privacy-notices/de.js');
    const serialized = JSON.stringify(dePrivacy);
    // Phase 57 (D-11, D-14) — invoice-footer phrases are rendered on invoices,
    // NOT in privacy notices; exempt them from the privacy-notice content check.
    // Phase 58 (D-07) — classification criteria titles live in classification
    // rule sets (packages/classification), not in privacy notices.
    // Phase 59 (D-18) — DRV defense bundle strings live in the DRV PDF template
    // (packages/api/src/pdf-templates/drv-defense-bundle.tsx), not in privacy notices.
    const privacyScopedKeys = new Set([
      'TAX_KLEINUNTERNEHMER_NOTICE',
      'TAX_STEUERSCHULDNERSCHAFT',
      'CLASSIFICATION_SCHEIN_TITLE',
      'CLASSIFICATION_SCHEIN_ASSESSMENT_LABEL',
      'CLASSIFICATION_SCHEIN_CRITERIA_LABEL',
      'CLASSIFICATION_SCHEIN_INTEGRATION',
      'CLASSIFICATION_SCHEIN_ENTREPRENEURIAL',
      'CLASSIFICATION_SCHEIN_PERSONAL_DEP',
      'CLASSIFICATION_SCHEIN_ECONOMIC_DEP',
      'CLASSIFICATION_SCHEIN_DRV_REFERENCE_LABEL',
      'CLASSIFICATION_SCHEIN_NOT_APPLICABLE',
      'DRV_DEFENSE_COVER_HEADER_DE',
      'DRV_DEFENSE_SECTION_TITLES_DE',
      'DRV_DEFENSE_TABLE_HEADERS_DE',
      'DRV_DEFENSE_ATTESTATION_FOOTER_DE',
      'DRV_DEFENSE_CROSS_REFERENCE_FOOTER_DE',
      // Phase 60 (CLASS-09) — DRV clearance panel phrases live on the engagement page,
      // not in privacy notices.
      'DRV_CLEARANCE_PANEL_HEADER_DE',
      'DRV_CLEARANCE_SECTION_REFERENCE_DE',
      // Phase 63 (D-22) — Skonto description template lives on invoice detail,
      // not in privacy notices.
      'SKONTO_DESCRIPTION_TEMPLATE_DE',
      // Phase 62 (EINV-02, EINV-03) — intake error phrases render in the
      // upload dialog + detail action bar, not in privacy notices.
      'EINVOICE_INTAKE_XSD_REJECT_DE',
      'EINVOICE_INTAKE_LEVEL_TOO_LOW_DE',
      'EINVOICE_INTAKE_EXTENDED_BEST_EFFORT_DE',
    ]);
    for (const [key, phrase] of Object.entries(LOCKED_DE_PHRASES)) {
      if (privacyScopedKeys.has(key)) continue;
      if (typeof phrase !== 'string') continue;
      expect(serialized, `Missing ${key}="${phrase}" in privacy-notices/de.ts`).toContain(phrase);
    }
  });

  it('messages/de.json uses formal "Sie" register (no Du/Dir/Dein…)', () => {
    const dePath = path.join(messagesDir, 'de.json');
    if (!fs.existsSync(dePath)) return; // Implemented by Plan 05

    const raw = fs.readFileSync(dePath, 'utf8');
    // Match Du / Dir / Dein(e|er|es|em) as whole words bordered by
    // whitespace/quote/punctuation on each side.
    const informal = raw.match(/["\s](Du|Dir|Dein[a-z]*)[^a-zA-Z]/g);
    expect(
      informal,
      `Informal register detected in de.json: ${informal?.join(', ') ?? ''}`,
    ).toBeNull();
  });

  it('RESERVED_LEGAL_KEYS mirrors LOCKED_DE_PHRASES keys', () => {
    expect([...RESERVED_LEGAL_KEYS].sort()).toEqual(Object.keys(LOCKED_DE_PHRASES).sort());
  });

  it('every LOCKED_DE_PHRASES value is a non-empty string (or object with non-empty string leaves)', () => {
    function assertAllStringLeavesNonEmpty(key: string, v: unknown): void {
      if (typeof v === 'string') {
        expect(v.length, `${key} is empty`).toBeGreaterThan(0);
        return;
      }
      // Phase 59 — DRV_DEFENSE_SECTION_TITLES_DE / DRV_DEFENSE_TABLE_HEADERS_DE
      // are nested objects of locked strings.
      expect(v, `${key} is neither string nor object`).toBeTypeOf('object');
      for (const [childKey, childValue] of Object.entries(v as Record<string, unknown>)) {
        assertAllStringLeavesNonEmpty(`${key}.${childKey}`, childValue);
      }
    }
    for (const [key, value] of Object.entries(LOCKED_DE_PHRASES)) {
      assertAllStringLeavesNonEmpty(key, value);
    }
  });

  it('contains the GDPR controller label verbatim', () => {
    expect(LOCKED_DE_PHRASES.GDPR_CONTROLLER_LABEL).toBe('Verantwortlicher im Sinne der DSGVO');
  });

  it('contains the Kleinunternehmer label with Unicode chars preserved', () => {
    // Unicode sanity — § and ä must round-trip (not be mojibake'd).
    expect(LOCKED_DE_PHRASES.TAX_KLEINUNTERNEHMER_LABEL).toBe('Kleinunternehmer gemäß § 19 UStG');
  });
});

describe('DE locked tax-notice phrases (Phase 57 — D-11, D-14)', () => {
  it('TAX_KLEINUNTERNEHMER_NOTICE matches the § 19 UStG canonical form', () => {
    expect(LOCKED_DE_PHRASES.TAX_KLEINUNTERNEHMER_NOTICE).toBe(
      'Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen',
    );
  });

  it('TAX_STEUERSCHULDNERSCHAFT matches the §13b UStG reverse-charge footer phrase', () => {
    expect(LOCKED_DE_PHRASES.TAX_STEUERSCHULDNERSCHAFT).toBe(
      'Steuerschuldnerschaft des Leistungsempfängers',
    );
  });
});

describe('Phase 58 — CLASSIFICATION_* locked phrases (D-07)', () => {
  const CLASSIFICATION_KEYS = [
    'CLASSIFICATION_SCHEIN_TITLE',
    'CLASSIFICATION_SCHEIN_ASSESSMENT_LABEL',
    'CLASSIFICATION_SCHEIN_CRITERIA_LABEL',
    'CLASSIFICATION_SCHEIN_INTEGRATION',
    'CLASSIFICATION_SCHEIN_ENTREPRENEURIAL',
    'CLASSIFICATION_SCHEIN_PERSONAL_DEP',
    'CLASSIFICATION_SCHEIN_ECONOMIC_DEP',
    'CLASSIFICATION_SCHEIN_DRV_REFERENCE_LABEL',
    'CLASSIFICATION_SCHEIN_NOT_APPLICABLE',
  ] as const;

  it.each(
    locales,
  )('messages/%s.json does not define any CLASSIFICATION_* key as a (nested) property', locale => {
    const messages = loadMessages(locale);
    if (messages === null) return;
    const keys = flatKeys(messages);
    const violations = keys.filter(k =>
      CLASSIFICATION_KEYS.some(r => k === r || k.endsWith(`.${r}`)),
    );
    expect(
      violations,
      `CLASSIFICATION_* keys leaked into ${locale}.json: ${violations.join(', ')}`,
    ).toEqual([]);
  });

  it.each(
    locales,
  )('messages/%s.json does not contain any CLASSIFICATION_* value verbatim', locale => {
    const filePath = path.join(messagesDir, `${locale}.json`);
    if (!fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, 'utf8');
    for (const key of CLASSIFICATION_KEYS) {
      const value = (LOCKED_DE_PHRASES as Record<string, string>)[key];
      if (!value) continue;
      expect(
        raw.includes(`"${value}"`),
        `CLASSIFICATION value "${value}" found verbatim in ${locale}.json`,
      ).toBe(false);
    }
  });

  it('RESERVED_LEGAL_KEYS includes all CLASSIFICATION_* keys', () => {
    for (const key of CLASSIFICATION_KEYS) {
      expect(RESERVED_LEGAL_KEYS).toContain(key);
    }
  });
});

describe('Phase 58 — DISCLAIMER_* locked bilingual disclaimers (D-12)', () => {
  it.each(
    locales,
  )('messages/%s.json does not define any DISCLAIMER_* key as a (nested) property', locale => {
    const messages = loadMessages(locale);
    if (messages === null) return;
    const keys = flatKeys(messages);
    const violations = keys.filter(k =>
      RESERVED_DISCLAIMER_KEYS.some(r => k === r || k.endsWith(`.${r}`)),
    );
    expect(
      violations,
      `DISCLAIMER_* keys leaked into ${locale}.json: ${violations.join(', ')}`,
    ).toEqual([]);
  });

  it('RESERVED_DISCLAIMER_KEYS mirrors LOCKED_DISCLAIMERS keys', () => {
    expect([...RESERVED_DISCLAIMER_KEYS].sort()).toEqual(Object.keys(LOCKED_DISCLAIMERS).sort());
  });

  it('every LOCKED_DISCLAIMERS value is a non-empty string', () => {
    for (const [key, value] of Object.entries(LOCKED_DISCLAIMERS)) {
      expect(typeof value, `${key} is not a string`).toBe('string');
      expect(value.length, `${key} is empty`).toBeGreaterThan(0);
    }
  });

  it('IR35 disclaimer contains the ITEPA 2003 statutory reference', () => {
    expect(LOCKED_DISCLAIMERS.DISCLAIMER_IR35_BODY).toContain('Chapter 10 ITEPA 2003');
  });

  it('Schein disclaimer contains the § 7a SGB IV reference with Unicode preserved', () => {
    expect(LOCKED_DISCLAIMERS.DISCLAIMER_SCHEIN_BODY).toContain('§ 7a SGB IV');
  });
});

describe('UK locked phrases (Phase 57 — D-14)', () => {
  it('TAX_UK_REVERSE_CHARGE_NOTICE matches the HMRC VAT Notice 741A phrasing', () => {
    expect(LOCKED_EN_PHRASES.TAX_UK_REVERSE_CHARGE_NOTICE).toBe(
      'Reverse charge: Customer to pay the VAT to HMRC',
    );
  });

  it('RESERVED_EN_LEGAL_KEYS mirrors LOCKED_EN_PHRASES keys', () => {
    expect([...RESERVED_EN_LEGAL_KEYS].sort()).toEqual(Object.keys(LOCKED_EN_PHRASES).sort());
  });

  it('every LOCKED_EN_PHRASES value is a non-empty string', () => {
    for (const [key, value] of Object.entries(LOCKED_EN_PHRASES)) {
      expect(typeof value, `${key} is not a string`).toBe('string');
      expect(value.length, `${key} is empty`).toBeGreaterThan(0);
    }
  });
});

// -----------------------------------------------------------------------------
// Phase 59 · D-18 — prefix-based CI guard for IR35 SDS + DRV defense strings.
// See .planning/phases/59-classification-documents-chain-tracking/59-RESEARCH.md §Pattern 5.
// -----------------------------------------------------------------------------

const RESERVED_PHASE_59_PREFIXES = ['IR35_DISPUTE_', 'SDS_', 'DRV_DEFENSE_'] as const;

describe('Locked phrase prefixes (Phase 59 · D-18)', () => {
  it.each(
    locales,
  )('messages/%s.json does not contain any key with prefix IR35_DISPUTE_ / SDS_ / DRV_DEFENSE_', locale => {
    const messages = loadMessages(locale);
    if (messages === null) return;

    const flattenedKeys = flatKeys(messages);
    const leaks = flattenedKeys.filter(key =>
      RESERVED_PHASE_59_PREFIXES.some(prefix => key.includes(prefix)),
    );

    expect(
      leaks,
      `Reserved Phase 59 prefix keys leaked into ${locale}.json: ${leaks.join(', ')}`,
    ).toEqual([]);
  });
});

// -----------------------------------------------------------------------------
// Phase 60 · CLASS-09 — prefix-based CI guard for DRV clearance panel strings.
// See .planning/phases/60-classification-polish/60-03-PLAN.md.
// -----------------------------------------------------------------------------

const RESERVED_PHASE_60_PREFIXES = ['DRV_CLEARANCE_'] as const;

describe('Locked phrase prefixes (Phase 60 · CLASS-09)', () => {
  it.each(
    locales,
  )('messages/%s.json does not contain any key with prefix DRV_CLEARANCE_', locale => {
    const messages = loadMessages(locale);
    if (messages === null) return;

    const flattenedKeys = flatKeys(messages);
    const leaks = flattenedKeys.filter(key =>
      RESERVED_PHASE_60_PREFIXES.some(prefix => key.includes(prefix)),
    );

    expect(
      leaks,
      `Reserved Phase 60 prefix keys leaked into ${locale}.json: ${leaks.join(', ')}`,
    ).toEqual([]);
  });

  it('DRV_CLEARANCE_PANEL_HEADER_DE contains the § 7a SGB IV statutory reference', () => {
    expect(LOCKED_DE_PHRASES.DRV_CLEARANCE_PANEL_HEADER_DE).toContain('§ 7a SGB IV');
  });

  it('DRV_CLEARANCE_PANEL_HEADER_DE uses Statusfeststellungsverfahren canonical form', () => {
    expect(LOCKED_DE_PHRASES.DRV_CLEARANCE_PANEL_HEADER_DE).toContain(
      'Statusfeststellungsverfahren',
    );
  });
});

// -----------------------------------------------------------------------------
// Phase 63 — GB locked phrases (LPCDA claim letter, D-17)
// -----------------------------------------------------------------------------

describe('Phase 63 — GB locked phrases', () => {
  it('LPCDA_CLAIM_FOOTER matches the statutory reference verbatim', () => {
    expect(LPCDA_CLAIM_FOOTER).toBe(
      'This claim is made under the Late Payment of Commercial Debts (Interest) Act 1998 as amended by the Late Payment of Commercial Debts Regulations 2013.',
    );
  });

  it('LPCDA_STATUTORY_RATE_LABEL matches the BoE + 8% description', () => {
    expect(LPCDA_STATUTORY_RATE_LABEL).toBe('Bank of England base rate plus 8 percentage points');
  });

  it('LPCDA_COMPENSATION_LABEL matches Section 5A reference', () => {
    expect(LPCDA_COMPENSATION_LABEL).toBe('Fixed sum compensation under Section 5A');
  });

  it('LPCDA_SECTION_REF matches Sections 3, 4, and 5A reference', () => {
    expect(LPCDA_SECTION_REF).toBe(
      'Late Payment of Commercial Debts (Interest) Act 1998, Sections 3, 4, and 5A',
    );
  });

  it('RESERVED_GB_LEGAL_KEYS mirrors LOCKED_GB_PHRASES keys', () => {
    expect([...RESERVED_GB_LEGAL_KEYS].sort()).toEqual(Object.keys(LOCKED_GB_PHRASES).sort());
  });

  it('every LOCKED_GB_PHRASES value is a non-empty string', () => {
    for (const [key, value] of Object.entries(LOCKED_GB_PHRASES)) {
      expect(typeof value, `${key} is not a string`).toBe('string');
      expect(value.length, `${key} is empty`).toBeGreaterThan(0);
    }
  });

  it.each(
    locales,
  )('messages/%s.json does not define any LPCDA_* key as a (nested) property', locale => {
    const messages = loadMessages(locale);
    if (messages === null) return;
    const keys = flatKeys(messages);
    const violations = keys.filter(k =>
      RESERVED_GB_LEGAL_KEYS.some(r => k === r || k.endsWith(`.${r}`)),
    );
    expect(violations, `LPCDA_* keys leaked into ${locale}.json: ${violations.join(', ')}`).toEqual(
      [],
    );
  });
});

// -----------------------------------------------------------------------------
// Phase 63 — DE Skonto locked phrase (D-22)
// -----------------------------------------------------------------------------

describe('Phase 63 — DE Skonto locked phrase', () => {
  it('SKONTO_DESCRIPTION_TEMPLATE_DE matches the canonical German Skonto template', () => {
    expect(SKONTO_DESCRIPTION_TEMPLATE_DE).toBe(
      '{percent}% Skonto bei Zahlung innerhalb von {discountDays} Tagen, sonst netto {netDays} Tage',
    );
  });

  it('SKONTO_DESCRIPTION_TEMPLATE_DE is present in LOCKED_DE_PHRASES', () => {
    expect(LOCKED_DE_PHRASES.SKONTO_DESCRIPTION_TEMPLATE_DE).toBe(SKONTO_DESCRIPTION_TEMPLATE_DE);
  });

  it('RESERVED_LEGAL_KEYS includes SKONTO_DESCRIPTION_TEMPLATE_DE', () => {
    expect(RESERVED_LEGAL_KEYS).toContain('SKONTO_DESCRIPTION_TEMPLATE_DE');
  });
});

// -----------------------------------------------------------------------------
// Phase 62 — DE intake locked phrases (EINV-02, EINV-03)
// -----------------------------------------------------------------------------

describe('Phase 62 — DE intake locked phrases', () => {
  it('EINVOICE_INTAKE_XSD_REJECT_DE matches the canonical CII-XSD reject form', () => {
    expect(EINVOICE_INTAKE_XSD_REJECT_DE).toBe(
      'Die XML entspricht nicht dem CII-Schema — bitten Sie den Absender, erneut auszustellen.',
    );
  });

  it('EINVOICE_INTAKE_LEVEL_TOO_LOW_DE mentions the ZUGFeRD profile placeholder', () => {
    expect(EINVOICE_INTAKE_LEVEL_TOO_LOW_DE).toContain('ZUGFeRD-Profil {level}');
    expect(EINVOICE_INTAKE_LEVEL_TOO_LOW_DE).toContain('COMFORT- oder XRECHNUNG-Profil');
  });

  it('EINVOICE_INTAKE_EXTENDED_BEST_EFFORT_DE mentions the EXTENDED profile banner', () => {
    expect(EINVOICE_INTAKE_EXTENDED_BEST_EFFORT_DE).toContain('EXTENDED-ZUGFeRD-Profil');
    expect(EINVOICE_INTAKE_EXTENDED_BEST_EFFORT_DE).toContain('absenderspezifische Felder');
  });

  it('all three constants are registered in LOCKED_DE_PHRASES', () => {
    expect(LOCKED_DE_PHRASES.EINVOICE_INTAKE_XSD_REJECT_DE).toBe(EINVOICE_INTAKE_XSD_REJECT_DE);
    expect(LOCKED_DE_PHRASES.EINVOICE_INTAKE_LEVEL_TOO_LOW_DE).toBe(
      EINVOICE_INTAKE_LEVEL_TOO_LOW_DE,
    );
    expect(LOCKED_DE_PHRASES.EINVOICE_INTAKE_EXTENDED_BEST_EFFORT_DE).toBe(
      EINVOICE_INTAKE_EXTENDED_BEST_EFFORT_DE,
    );
  });

  it('RESERVED_LEGAL_KEYS includes all three Phase 62 identifiers', () => {
    expect(RESERVED_LEGAL_KEYS).toContain('EINVOICE_INTAKE_XSD_REJECT_DE');
    expect(RESERVED_LEGAL_KEYS).toContain('EINVOICE_INTAKE_LEVEL_TOO_LOW_DE');
    expect(RESERVED_LEGAL_KEYS).toContain('EINVOICE_INTAKE_EXTENDED_BEST_EFFORT_DE');
  });

  it('messages/de.json carries the XSD reject phrase verbatim as a VALUE (parity)', () => {
    const dePath = path.join(messagesDir, 'de.json');
    if (!fs.existsSync(dePath)) return;
    const raw = fs.readFileSync(dePath, 'utf8');
    // The intake.errorXsdReject value extends the locked phrase with the
    // ": First errors {errors}" suffix. Assert the locked phrase appears as
    // a substring so any paraphrase of the canonical form fails the guard.
    expect(raw).toContain(EINVOICE_INTAKE_XSD_REJECT_DE);
  });

  it('messages/de.json carries the level-too-low phrase verbatim as a VALUE (parity)', () => {
    const dePath = path.join(messagesDir, 'de.json');
    if (!fs.existsSync(dePath)) return;
    const raw = fs.readFileSync(dePath, 'utf8');
    expect(raw).toContain(EINVOICE_INTAKE_LEVEL_TOO_LOW_DE);
  });

  it('messages/de.json carries the EXTENDED best-effort banner verbatim as a VALUE (parity)', () => {
    const dePath = path.join(messagesDir, 'de.json');
    if (!fs.existsSync(dePath)) return;
    const raw = fs.readFileSync(dePath, 'utf8');
    expect(raw).toContain(EINVOICE_INTAKE_EXTENDED_BEST_EFFORT_DE);
  });
});

// -----------------------------------------------------------------------------
// Phase 64 · D-14 (Layer 1) — signoff registry CI guard.
// Asserts structural invariants on every PR (always-run).
// Layer 2 (production PENDING block) is in .github/workflows/ci.yml.
// -----------------------------------------------------------------------------

describe('Phase 64 — Signoff registry CI guard (D-14 Layer 1)', () => {
  it('signoff-registry.json parses against SignoffRegistrySchema without errors', () => {
    expect(() => SignoffRegistrySchema.parse(rawRegistry)).not.toThrow();
  });

  it('every key in LOCKED_DISCLAIMERS has a corresponding signoff-registry entry', () => {
    const registry = getRegistry();
    for (const key of Object.keys(LOCKED_DISCLAIMERS)) {
      expect(
        registry[key],
        `Disclaimer key "${key}" missing from signoff-registry.json — add a PENDING entry`,
      ).toBeDefined();
    }
  });

  it('APPROVED entries have required fields (approvedBy, approvedAt, approverRole)', () => {
    const registry = getRegistry();
    for (const [key, entry] of Object.entries(registry)) {
      if (entry.status === 'APPROVED') {
        expect(entry.approvedBy, `${key}: APPROVED entry missing approvedBy`).toBeTruthy();
        expect(entry.approvedAt, `${key}: APPROVED entry missing approvedAt`).toBeTruthy();
        expect(entry.approverRole, `${key}: APPROVED entry missing approverRole`).toBeTruthy();
      }
    }
  });

  it.each(
    locales,
  )('messages/%s.json does not define any BANNER_* / SDS_APPROVAL_* / DRV_UNVERIFIED_* / SOFTWARE_NOT_LEGAL_ADVICE_* key', locale => {
    const messages = loadMessages(locale);
    if (messages === null) return;
    const keys = flatKeys(messages);
    const PHASE_64_PREFIXES = [
      'BANNER_IR35_ADVISORY',
      'BANNER_SCHEIN_ADVISORY',
      'SDS_APPROVAL_STATEMENT',
      'DRV_UNVERIFIED_ENTRY',
      'SOFTWARE_NOT_LEGAL_ADVICE',
    ] as const;
    const leaks = keys.filter(k => PHASE_64_PREFIXES.some(prefix => k.includes(prefix)));
    expect(
      leaks,
      `Phase 64 locked phrase prefix leaked into ${locale}.json: ${leaks.join(', ')}`,
    ).toEqual([]);
  });

  it('BANNER_IR35_ADVISORY_EN references IR35 and UK tax adviser', () => {
    expect(BANNER_IR35_ADVISORY_EN).toContain('IR35');
    expect(BANNER_IR35_ADVISORY_EN).toContain('tax adviser');
  });

  it('BANNER_SCHEIN_ADVISORY_DE references § 7a SGB IV and Statusfeststellungsverfahren', () => {
    expect(BANNER_SCHEIN_ADVISORY_DE).toContain('§ 7a SGB IV');
    expect(BANNER_SCHEIN_ADVISORY_DE).toContain('Statusfeststellungsverfahren');
  });

  it('SDS_APPROVAL_STATEMENT_EN references Chapter 10 ITEPA 2003', () => {
    expect(SDS_APPROVAL_STATEMENT_EN).toContain('Chapter 10 ITEPA 2003');
  });

  it('SOFTWARE_NOT_LEGAL_ADVICE_EN covers classification, e-invoicing, payments, and interest', () => {
    expect(SOFTWARE_NOT_LEGAL_ADVICE_EN).toContain('Classification');
    expect(SOFTWARE_NOT_LEGAL_ADVICE_EN).toContain('invoicing');
    expect(SOFTWARE_NOT_LEGAL_ADVICE_EN).toContain('Payment');
    expect(SOFTWARE_NOT_LEGAL_ADVICE_EN).toContain('interest');
  });

  it('RESERVED_DISCLAIMER_KEYS includes all 6 Phase 64 new keys', () => {
    const phase64Keys = [
      'BANNER_IR35_ADVISORY_EN',
      'BANNER_SCHEIN_ADVISORY_DE',
      'SDS_APPROVAL_STATEMENT_EN',
      'DRV_UNVERIFIED_ENTRY_DISCLAIMER_DE',
      'SOFTWARE_NOT_LEGAL_ADVICE_EN',
      'SOFTWARE_NOT_LEGAL_ADVICE_DE',
    ];
    for (const key of phase64Keys) {
      expect(RESERVED_DISCLAIMER_KEYS).toContain(key);
    }
  });

  it('getAllPending() returns all registry keys while every entry is PENDING (12 Phase 64 disclaimers + 17 Phase 75 IP clauses)', () => {
    const pending = getAllPending();
    // All registry keys remain PENDING until legal sign-off
    // (legal-signoff.ip_clauses.*, all PENDING pending adviser sign-off).
    expect(pending.length).toBeGreaterThan(0);
    // The 12 base disclaimer keys must still be PENDING.
    for (const key of Object.keys(LOCKED_DISCLAIMERS)) {
      expect(pending, `disclaimer key "${key}" no longer PENDING`).toContain(key);
    }
    // All 17 Phase 75 IP-clause sign-offs must be PENDING (legal review outstanding).
    const ipClausePending = pending.filter(k => k.startsWith('legal-signoff.ip_clauses.'));
    expect(ipClausePending).toHaveLength(17);
  });

  it('isAllApproved() returns false when all entries are PENDING', () => {
    expect(isAllApproved()).toBe(false);
  });

  it('DRV_UNVERIFIED_ENTRY_DISCLAIMER_DE references DRV and Bescheid', () => {
    expect(DRV_UNVERIFIED_ENTRY_DISCLAIMER_DE).toContain('DRV');
    expect(DRV_UNVERIFIED_ENTRY_DISCLAIMER_DE).toContain('Bescheid');
  });
});

// -----------------------------------------------------------------------------
// Phase 79 (F3 Gulf) — AE/SA locked statutory phrases (GULF-09, D-14/D-15)
// -----------------------------------------------------------------------------

describe('Phase 79 — AE locked phrases (UAE free-zone authority legal names)', () => {
  it('RESERVED_AE_LEGAL_KEYS mirrors LOCKED_AE_PHRASES keys', () => {
    expect([...RESERVED_AE_LEGAL_KEYS].sort()).toEqual(Object.keys(LOCKED_AE_PHRASES).sort());
  });

  it('every LOCKED_AE_PHRASES value is a non-empty string', () => {
    for (const [key, value] of Object.entries(LOCKED_AE_PHRASES)) {
      expect(typeof value, `${key} is not a string`).toBe('string');
      expect(value.length, `${key} is empty`).toBeGreaterThan(0);
    }
  });

  it.each(
    locales,
  )('messages/%s.json does not define any RESERVED_AE_LEGAL_KEYS key as a (nested) property', locale => {
    const messages = loadMessages(locale);
    if (messages === null) return;
    const keys = flatKeys(messages);
    const violations = keys.filter(k =>
      RESERVED_AE_LEGAL_KEYS.some(r => k === r || k.endsWith(`.${r}`)),
    );
    expect(
      violations,
      `AE locked keys leaked into ${locale}.json: ${violations.join(', ')}`,
    ).toEqual([]);
  });
});

describe('Phase 79 — SA locked phrases (Nitaqat band labels + Qiwa terms)', () => {
  it('RESERVED_SA_LEGAL_KEYS mirrors LOCKED_SA_PHRASES keys', () => {
    expect([...RESERVED_SA_LEGAL_KEYS].sort()).toEqual(Object.keys(LOCKED_SA_PHRASES).sort());
  });

  it('every LOCKED_SA_PHRASES value is a non-empty string', () => {
    for (const [key, value] of Object.entries(LOCKED_SA_PHRASES)) {
      expect(typeof value, `${key} is not a string`).toBe('string');
      expect(value.length, `${key} is empty`).toBeGreaterThan(0);
    }
  });

  it('Nitaqat band labels are the literal UPPER_SNAKE NitaqatBand enum strings', () => {
    expect(LOCKED_SA_PHRASES.NITAQAT_BAND_PLATINUM).toBe('PLATINUM');
    expect(LOCKED_SA_PHRASES.NITAQAT_BAND_HIGH_GREEN).toBe('HIGH_GREEN');
    expect(LOCKED_SA_PHRASES.NITAQAT_BAND_MID_GREEN).toBe('MID_GREEN');
    expect(LOCKED_SA_PHRASES.NITAQAT_BAND_LOW_GREEN).toBe('LOW_GREEN');
    expect(LOCKED_SA_PHRASES.NITAQAT_BAND_YELLOW).toBe('YELLOW');
    expect(LOCKED_SA_PHRASES.NITAQAT_BAND_RED).toBe('RED');
  });

  it.each(
    locales,
  )('messages/%s.json does not define any RESERVED_SA_LEGAL_KEYS key as a (nested) property', locale => {
    const messages = loadMessages(locale);
    if (messages === null) return;
    const keys = flatKeys(messages);
    const violations = keys.filter(k =>
      RESERVED_SA_LEGAL_KEYS.some(r => k === r || k.endsWith(`.${r}`)),
    );
    expect(
      violations,
      `SA locked keys leaked into ${locale}.json: ${violations.join(', ')}`,
    ).toEqual([]);
  });
});
