/**
 * Per-jurisdiction personnel-file ("akta osobowe" / Personalakte) section
 * taxonomy and retention-rule registry. Register-on-import, mirroring
 * doc-registry.ts: a module-level Map seeded by a BASELINE loop that throws on a
 * duplicate (jurisdiction, section) id, so overlapping seed entries can never
 * silently override one another.
 *
 * Retention years are NOT stored here — each rule names a recordType token that
 * keys the single shared RETENTION_YEARS map in @contractor-ops/db. This module
 * owns only the rule SHAPE (anchor + citation) and the doc-type -> section map,
 * which keeps it free of any @contractor-ops/db import (db depends on this
 * package, so the dependency must stay one-way).
 *
 * Legal note: every section label and retention citation is seeded reference
 * data carrying a legal/tax-adviser-verify annotation, not a live statutory
 * lookup (LOCAL-ONLY; sign-off deferred).
 */

import type {
  PersonnelFileSection,
  PersonnelRetentionRule,
  PersonnelSection,
} from './personnel-types';
import type { Jurisdiction } from './types';

/** Appended to every seeded statutory string per the standing legal-review constraint. */
const ADVISER_VERIFY = '(PENDING jurisdiction legal/tax adviser verification)';

const sections = new Map<string, PersonnelSection>();

function sectionKey(jurisdiction: Jurisdiction, id: PersonnelFileSection): string {
  return `${jurisdiction}:${id}`;
}

export function registerPersonnelSection(section: PersonnelSection): void {
  const key = sectionKey(section.jurisdiction, section.id);
  if (sections.has(key)) {
    throw new Error(`Personnel section already registered: ${key}`);
  }
  sections.set(key, section);
}

export function clearPersonnelSections(): void {
  sections.clear();
}

/** Every registered section for a jurisdiction (SECTION_A..D). */
export function getPersonnelSections(jurisdiction: Jurisdiction): PersonnelSection[] {
  return Array.from(sections.values()).filter(section => section.jurisdiction === jurisdiction);
}

/** Retention rules for a (jurisdiction, section); empty when the section carries none. */
export function getPersonnelRetentionRules(
  jurisdiction: Jurisdiction,
  section: PersonnelFileSection,
): PersonnelRetentionRule[] {
  return sections.get(sectionKey(jurisdiction, section))?.retentionRules ?? [];
}

/**
 * Deterministic doc-type -> section resolution for a jurisdiction. Returns null
 * when no section claims the document type, so the caller can fall through to
 * the AI classifier / admin classify-step rather than guess.
 */
export function resolveSectionForDocumentType(
  jurisdiction: Jurisdiction,
  documentType: string,
): PersonnelSection | null {
  for (const section of getPersonnelSections(jurisdiction)) {
    if (section.documentTypes.includes(documentType)) {
      return section;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Retention rules (statutory windows) shared across a jurisdiction's sections.
// ---------------------------------------------------------------------------

// Poland keeps the whole akta osobowe for a single window measured from the end
// of employment; which regime applies is chosen by employment-start date.
const PL_AKTA_RULES: PersonnelRetentionRule[] = [
  {
    recordType: 'pl-akta-post2019',
    anchor: 'TERMINATION_DATE',
    citation: `Kodeks pracy art. 94(4)-94(6) + 2018 rozporzadzenie MRPiPS: 10-year akta osobowe retention for employment starting on/after 2019-01-01 ${ADVISER_VERIFY}`,
  },
  {
    recordType: 'pl-akta-legacy',
    anchor: 'TERMINATION_DATE',
    citation: `Kodeks pracy art. 94(5) (pre-2019 regime): 50-year akta osobowe retention for employment starting before 2019-01-01 ${ADVISER_VERIFY}`,
  },
];

const DE_PERSONALAKTE_TAX: PersonnelRetentionRule = {
  recordType: 'de-personalakte-tax',
  anchor: 'TERMINATION_DATE',
  citation: `AO section 147 / HGB section 257: 10-year retention for tax- and commercially-relevant Personalakte records ${ADVISER_VERIFY}`,
};

const DE_ACCIDENT_RECORDS: PersonnelRetentionRule = {
  recordType: 'de-accident-records',
  anchor: 'DOCUMENT_DATE',
  citation: `ArbMedVV / DGUV Vorschrift 1: 30-year retention for occupational-health and accident records ${ADVISER_VERIFY}`,
};

const UK_PERSONNEL_GENERAL: PersonnelRetentionRule = {
  recordType: 'uk-personnel-general',
  anchor: 'TERMINATION_DATE',
  citation: `Limitation Act 1980: 6-year retention for general personnel records after employment ends ${ADVISER_VERIFY}`,
};

const UK_PERSONNEL_FINANCIAL: PersonnelRetentionRule = {
  recordType: 'uk-personnel-financial',
  anchor: 'TERMINATION_DATE',
  citation: `HMRC PAYE payroll records + Limitation Act 1980: 7-year retention for pay and financial records ${ADVISER_VERIFY}`,
};

// US I-9 is the two-anchor case: keep the later of hire+3y or termination+1y,
// which the retention resolver combines with max().
const US_I9_RULES: PersonnelRetentionRule[] = [
  {
    recordType: 'us-i9-post-hire',
    anchor: 'HIRE_DATE',
    citation: `8 CFR 274a.2: Form I-9 retained 3 years after date of hire ${ADVISER_VERIFY}`,
  },
  {
    recordType: 'us-i9-post-termination',
    anchor: 'TERMINATION_DATE',
    citation: `8 CFR 274a.2: Form I-9 retained 1 year after termination; keep the later of hire+3y or termination+1y ${ADVISER_VERIFY}`,
  },
];

// ---------------------------------------------------------------------------
// Baseline section taxonomy (register-on-import).
// ---------------------------------------------------------------------------

function definePersonnelSection(
  jurisdiction: Jurisdiction,
  id: PersonnelFileSection,
  statutory: boolean,
  documentTypes: string[],
  retentionRules: PersonnelRetentionRule[],
): PersonnelSection {
  return {
    jurisdiction,
    id,
    labelKey: `personnelFile.sections.${jurisdiction}.${id}.label`,
    adviserVerifyKey: `personnelFile.sections.${jurisdiction}.${id}.adviserVerify`,
    statutory,
    documentTypes,
    retentionRules,
  };
}

const BASELINE_SECTIONS: PersonnelSection[] = [
  // Poland — akta osobowe cz. A/B/C/D, statutory basis in Kodeks pracy art. 94.
  definePersonnelSection('PL', 'SECTION_A', true, ['BUSINESS_REGISTRATION', 'NDA'], PL_AKTA_RULES),
  definePersonnelSection(
    'PL',
    'SECTION_B',
    true,
    ['MASTER_CONTRACT', 'AMENDMENT', 'TAX_CERTIFICATE', 'INSURANCE'],
    PL_AKTA_RULES,
  ),
  definePersonnelSection('PL', 'SECTION_C', true, ['DELIVERABLE_ACCEPTANCE'], PL_AKTA_RULES),
  definePersonnelSection('PL', 'SECTION_D', true, ['OTHER'], PL_AKTA_RULES),

  // Germany — Personalakte groupings; no statutory section basis, so the file
  // structure is organisational while retention still binds tax/commercial rows.
  definePersonnelSection(
    'DE',
    'SECTION_A',
    false,
    ['BUSINESS_REGISTRATION', 'NDA'],
    [DE_PERSONALAKTE_TAX],
  ),
  definePersonnelSection(
    'DE',
    'SECTION_B',
    false,
    ['MASTER_CONTRACT', 'AMENDMENT', 'PAYMENT_EXPORT', 'INVOICE'],
    [DE_PERSONALAKTE_TAX],
  ),
  definePersonnelSection(
    'DE',
    'SECTION_C',
    false,
    ['TAX_CERTIFICATE', 'INSURANCE'],
    [DE_PERSONALAKTE_TAX, DE_ACCIDENT_RECORDS],
  ),
  definePersonnelSection('DE', 'SECTION_D', false, ['OTHER'], [DE_PERSONALAKTE_TAX]),

  // United Kingdom — personnel-file groupings; no statutory section basis.
  definePersonnelSection(
    'UK',
    'SECTION_A',
    false,
    ['BUSINESS_REGISTRATION', 'NDA'],
    [UK_PERSONNEL_GENERAL],
  ),
  definePersonnelSection(
    'UK',
    'SECTION_B',
    false,
    ['MASTER_CONTRACT', 'AMENDMENT'],
    [UK_PERSONNEL_GENERAL],
  ),
  definePersonnelSection(
    'UK',
    'SECTION_C',
    false,
    ['PAYMENT_EXPORT', 'INVOICE', 'TAX_CERTIFICATE', 'INSURANCE'],
    [UK_PERSONNEL_FINANCIAL],
  ),
  definePersonnelSection('UK', 'SECTION_D', false, ['OTHER'], [UK_PERSONNEL_GENERAL]),

  // United States — I-9 (SECTION_A) plus file equivalents. I-9 is expected to be
  // stored apart from the main personnel file under US practice, so its section
  // is flagged statutory and carries the two-anchor retention rule; the general
  // employment/certification/disciplinary sections have no single federal window.
  definePersonnelSection('US', 'SECTION_A', true, ['BUSINESS_REGISTRATION'], US_I9_RULES),
  definePersonnelSection('US', 'SECTION_B', true, ['MASTER_CONTRACT', 'AMENDMENT', 'NDA'], []),
  definePersonnelSection(
    'US',
    'SECTION_C',
    true,
    ['TAX_CERTIFICATE', 'PAYMENT_EXPORT', 'INVOICE', 'INSURANCE'],
    [],
  ),
  definePersonnelSection('US', 'SECTION_D', true, ['OTHER'], []),
];

for (const section of BASELINE_SECTIONS) {
  registerPersonnelSection(section);
}

/** Frozen snapshot of the seeded sections (re-read via getPersonnelSections after dynamic register). */
export const PERSONNEL_SECTION_REGISTRY: readonly PersonnelSection[] = Array.from(
  sections.values(),
);
