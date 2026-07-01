/**
 * RED scaffold — per-jurisdiction personnel-file section + retention registry.
 *
 * Terminal-RED via the missing exports on `../personnel-registry.ts` (the
 * register-on-import module that mirrors `doc-registry.ts`). The module does
 * not exist yet; a later wave builds it and turns this GREEN. The test directory
 * is excluded from tsc, so the missing module does not brick the typecheck.
 *
 * Locked behavior encoded:
 *   - PL/DE/UK/US each register four sections SECTION_A..D on import
 *   - registering a duplicate (jurisdiction, id) throws (mirrors doc-registry)
 *   - resolveSectionForDocumentType maps a known DocumentType → a section,
 *     unknown → null
 *   - US SECTION_A carries TWO retention rules (us-i9-post-hire +
 *     us-i9-post-termination)
 *   - single-source-of-years guard: every rule.recordType across all
 *     jurisdictions/sections is a key in the db RETENTION_YEARS map
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// None of these exist yet — this import is the terminal-RED anchor.
import {
  getPersonnelRetentionRules,
  getPersonnelSections,
  registerPersonnelSection,
  resolveSectionForDocumentType,
} from '../personnel-registry.js';

const JURISDICTIONS = ['PL', 'DE', 'UK', 'US'] as const;
const SECTION_IDS = ['SECTION_A', 'SECTION_B', 'SECTION_C', 'SECTION_D'] as const;

describe('personnel-file section registry — 4 sections per jurisdiction', () => {
  for (const jurisdiction of JURISDICTIONS) {
    it(`${jurisdiction} registers SECTION_A..D on import`, () => {
      const sections = getPersonnelSections(jurisdiction);
      const ids = sections.map(s => s.id).sort();
      expect(ids).toEqual([...SECTION_IDS]);
    });
  }
});

describe('personnel-file section registry — duplicate id throws', () => {
  it('re-registering an already-registered (jurisdiction, id) throws', () => {
    expect(() =>
      registerPersonnelSection({
        jurisdiction: 'PL',
        id: 'SECTION_A',
        labelKey: 'personnelFile.PL.sectionA',
        retentionRules: [],
        documentTypes: [],
      }),
    ).toThrow(/already registered/i);
  });
});

describe('resolveSectionForDocumentType', () => {
  it('maps a known DocumentType to one of SECTION_A..D', () => {
    const section = resolveSectionForDocumentType('PL', 'TAX_CERTIFICATE');
    expect(section).not.toBeNull();
    expect(SECTION_IDS).toContain(section?.id);
  });

  it('returns null for an unknown DocumentType', () => {
    expect(resolveSectionForDocumentType('PL', 'NOT_A_REAL_DOCUMENT_TYPE')).toBeNull();
  });
});

describe('US SECTION_A I-9 — two retention rules', () => {
  it('carries us-i9-post-hire and us-i9-post-termination', () => {
    const rules = getPersonnelRetentionRules('US', 'SECTION_A');
    const recordTypes = rules.map(r => r.recordType).sort();
    expect(recordTypes).toContain('us-i9-post-hire');
    expect(recordTypes).toContain('us-i9-post-termination');
    expect(rules.length).toBe(2);
  });
});

describe('single-source-of-years guard', () => {
  it('every personnel rule.recordType is a key in db RETENTION_YEARS', () => {
    const retentionSource = readFileSync(
      fileURLToPath(new URL('../../../db/src/retention-policy.ts', import.meta.url)),
      'utf8',
    );
    const start = retentionSource.indexOf('export const RETENTION_YEARS');
    expect(start, 'RETENTION_YEARS must exist in retention-policy.ts').toBeGreaterThanOrEqual(0);
    const end = retentionSource.indexOf('} as const;', start);
    const block = retentionSource.slice(start, end);
    const knownKeys = new Set(Array.from(block.matchAll(/'([^']+)'\s*:/g), m => m[1]));

    const recordTypes = new Set<string>();
    for (const jurisdiction of JURISDICTIONS) {
      for (const sectionId of SECTION_IDS) {
        for (const rule of getPersonnelRetentionRules(jurisdiction, sectionId)) {
          recordTypes.add(rule.recordType);
        }
      }
    }

    expect(recordTypes.size).toBeGreaterThan(0);
    for (const recordType of recordTypes) {
      expect(knownKeys, `${recordType} must be registered in RETENTION_YEARS`).toContain(
        recordType,
      );
    }
  });
});
