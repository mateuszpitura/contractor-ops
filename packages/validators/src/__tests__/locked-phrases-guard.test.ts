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

import { LOCKED_DE_PHRASES, RESERVED_LEGAL_KEYS } from '../legal/de.js';
import { LOCKED_DISCLAIMERS, RESERVED_DISCLAIMER_KEYS } from '../legal/disclaimers.js';
import { LOCKED_EN_PHRASES, RESERVED_EN_LEGAL_KEYS } from '../legal/en.js';

const messagesDir = path.resolve(__dirname, '../../../../apps/web/messages');
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
    const reserved = [...RESERVED_LEGAL_KEYS, ...RESERVED_EN_LEGAL_KEYS];
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
