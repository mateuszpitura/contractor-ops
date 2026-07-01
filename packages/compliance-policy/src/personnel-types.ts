// Type surface for the per-jurisdiction personnel-file section + retention
// registry. Runtime seed data lives in src/personnel-registry.ts.

import type { Jurisdiction } from './types';

/**
 * Canonical internal four-section model. Display labels + statutory basis vary
 * per jurisdiction (PL cz. A/B/C/D, DE Personalakte, UK personnel file, US I-9 +
 * file equivalents), but RBAC, retention, and classification stay uniform across
 * all four sections. Literal values mirror the Prisma PersonnelFileSection enum.
 */
export type PersonnelFileSection = 'SECTION_A' | 'SECTION_B' | 'SECTION_C' | 'SECTION_D';

/**
 * Event a retention clock starts from. While the employee is active (no
 * termination event) the file is retained indefinitely; the clock only starts
 * once its anchor event exists. US I-9 combines two anchors via max().
 */
export type RetentionAnchor = 'HIRE_DATE' | 'TERMINATION_DATE' | 'DOCUMENT_DATE';

/**
 * Stable record-type tokens shared with the single RETENTION_YEARS map in
 * @contractor-ops/db — each token names the statutory window (in years) there,
 * so years have exactly one source of truth.
 */
export type PersonnelRetentionRecordType =
  | 'pl-akta-post2019'
  | 'pl-akta-legacy'
  | 'de-personalakte-tax'
  | 'de-accident-records'
  | 'uk-personnel-general'
  | 'uk-personnel-financial'
  | 'us-i9-post-hire'
  | 'us-i9-post-termination';

/**
 * One statutory retention window for a section. Owns the SHAPE (anchor +
 * citation) only; the number of years is read from RETENTION_YEARS by the token.
 */
export interface PersonnelRetentionRule {
  recordType: PersonnelRetentionRecordType;
  anchor: RetentionAnchor;
  /** Statutory citation carrying the legal/tax-adviser-verify annotation. */
  citation: string;
}

/**
 * One registered section for a jurisdiction. Carries its own retention rules and
 * the deterministic set of Prisma DocumentType literal values that resolve to it.
 */
export interface PersonnelSection {
  jurisdiction: Jurisdiction;
  id: PersonnelFileSection;
  /** i18n leaf under personnelFile.sections.<jurisdiction>.<section>.label */
  labelKey: string;
  /** i18n leaf carrying the legal/tax-adviser-verify note (LOCAL-ONLY; sign-off deferred). */
  adviserVerifyKey: string;
  /** true where the section rests on a direct statutory basis (PL Kodeks pracy, US I-9); false for the DE/UK groupings that have no statutory section basis. */
  statutory: boolean;
  retentionRules: PersonnelRetentionRule[];
  /** Prisma DocumentType literal values that deterministically resolve to this section. */
  documentTypes: string[];
}
