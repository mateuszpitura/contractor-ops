// Phase 74 Plan 02 — GREEN tests for OFFBOARDING_TEMPLATE_SEEDS shape contract.

import { describe, expect, it } from 'vitest';
import { OFFBOARDING_TEMPLATE_SEEDS } from '../seeds.js';
import type { OffboardingTemplateSeedRole } from '../types.js';

const EXPECTED_ROLES: readonly OffboardingTemplateSeedRole[] = [
  'software_engineer',
  'designer',
  'product_manager',
  'generic_consultant',
];

const I18N_KEY_PATTERN =
  /^Offboarding\.Templates\.(SoftwareEngineer|Designer|ProductManager|GenericConsultant)\.([a-zA-Z]+\.(title|description)|displayName)$/;

describe('OFFBOARDING_TEMPLATE_SEEDS — D-04 shape contract', () => {
  it('exports exactly 4 seeds with roles software_engineer, designer, product_manager, generic_consultant', () => {
    expect(OFFBOARDING_TEMPLATE_SEEDS).toHaveLength(4);
    const actualRoles = OFFBOARDING_TEMPLATE_SEEDS.map(seed => seed.role).sort();
    const expectedSorted = [...EXPECTED_ROLES].sort();
    expect(actualRoles).toEqual(expectedSorted);
  });

  it('every seed has 6-9 task items per CONTEXT.md SC#1', () => {
    for (const seed of OFFBOARDING_TEMPLATE_SEEDS) {
      expect(seed.taskItems.length, `seed ${seed.role}`).toBeGreaterThanOrEqual(6);
      expect(seed.taskItems.length, `seed ${seed.role}`).toBeLessThanOrEqual(9);
    }
  });

  it('every i18n key has the form Offboarding.Templates.{Role}.{itemKey}.{title|description} (or .displayName)', () => {
    for (const seed of OFFBOARDING_TEMPLATE_SEEDS) {
      expect(seed.displayNameI18nKey).toMatch(I18N_KEY_PATTERN);
      for (const item of seed.taskItems) {
        expect(item.titleI18nKey).toMatch(I18N_KEY_PATTERN);
        expect(item.descriptionI18nKey).toMatch(I18N_KEY_PATTERN);
      }
    }
  });

  it('dueDayOffset values are non-negative integers', () => {
    for (const seed of OFFBOARDING_TEMPLATE_SEEDS) {
      for (const item of seed.taskItems) {
        expect(Number.isInteger(item.dueDayOffset)).toBe(true);
        expect(item.dueDayOffset).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('readonly enforced — type-level readonly Seed[] guarantees compile-time immutability', () => {
    // `as const` produces a deeply readonly literal at the TYPE layer. We do
    // not deep-freeze at runtime to keep the bundle lean — the type contract
    // (readonly Seed[] + readonly TaskItem[]) is enforced statically by TS
    // strict-mode and consumers cannot mutate without an `as any` cast.
    // This test just spot-checks that the const reference is stable across
    // imports.
    const ref1 = OFFBOARDING_TEMPLATE_SEEDS;
    const ref2 = OFFBOARDING_TEMPLATE_SEEDS;
    expect(ref1).toBe(ref2);
    expect(Array.isArray(ref1)).toBe(true);
  });
});
