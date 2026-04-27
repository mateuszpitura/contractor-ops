// TODO(Plan 74-02): implement seed-template assertions against
// OFFBOARDING_TEMPLATE_SEEDS once Plan 74-02 fills the typed-const seeds.

import { describe, it } from 'vitest';

describe('OFFBOARDING_TEMPLATE_SEEDS — D-04 shape contract', () => {
  it.todo(
    'exports exactly 4 seeds with roles software_engineer, designer, product_manager, generic_consultant',
  );
  it.todo('every seed has 6-9 task items per CONTEXT.md SC#1');
  it.todo('every i18n key has the form Offboarding.Templates.{Role}.{itemKey}.{title|description}');
  it.todo('dueDayOffset values are non-negative integers');
  it.todo('readonly enforced — Object.isFrozen on seeds and taskItems');
});
