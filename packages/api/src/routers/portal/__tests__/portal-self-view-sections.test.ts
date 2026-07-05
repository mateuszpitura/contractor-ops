import type { PersonnelFileSection } from '@contractor-ops/compliance-policy';
import { describe, expect, it } from 'vitest';
import { PERSONNEL_FILE_SECTIONS } from '../../core/personnel-file/section-access';
import {
  isSelfViewableSection,
  PERSONNEL_FILE_SELF_VIEW_SECTIONS,
} from '../portal-self-view-sections';

describe('PERSONNEL_FILE_SELF_VIEW_SECTIONS', () => {
  it('excludes SECTION_C (pay / PII) from the employee self-view', () => {
    expect(PERSONNEL_FILE_SELF_VIEW_SECTIONS).not.toContain('SECTION_C');
  });

  it('is a strict subset of the full section vocabulary', () => {
    const full = new Set<PersonnelFileSection>(PERSONNEL_FILE_SECTIONS);
    for (const section of PERSONNEL_FILE_SELF_VIEW_SECTIONS) {
      expect(full.has(section)).toBe(true);
    }
    expect(PERSONNEL_FILE_SELF_VIEW_SECTIONS.length).toBeLessThan(PERSONNEL_FILE_SECTIONS.length);
  });
});

describe('isSelfViewableSection', () => {
  it('returns true for the allowlisted sections A / B / D', () => {
    expect(isSelfViewableSection('SECTION_A')).toBe(true);
    expect(isSelfViewableSection('SECTION_B')).toBe(true);
    expect(isSelfViewableSection('SECTION_D')).toBe(true);
  });

  it('returns false for the excluded pay/PII section C', () => {
    expect(isSelfViewableSection('SECTION_C')).toBe(false);
  });
});
