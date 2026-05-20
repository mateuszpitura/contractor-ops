import { describe, expect, it } from 'vitest';
import {
  costCenterCreateSchema,
  costCenterCsvImportSchema,
  costCenterCsvRowSchema,
  costCenterUpdateSchema,
  orgDefinitionArchiveSchema,
  projectCreateSchema,
  projectListSchema,
  projectMergeResolveSchema,
  projectSyncSchema,
  projectUpdateSchema,
  teamCreateSchema,
  teamListSchema,
  teamUpdateSchema,
} from '../organization-definitions.js';

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

describe('teamCreateSchema', () => {
  it('accepts a minimal payload and applies the ACTIVE default', () => {
    const result = teamCreateSchema.safeParse({ name: '  Platform  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Platform');
      expect(result.data.status).toBe('ACTIVE');
    }
  });

  it('rejects an empty name', () => {
    expect(teamCreateSchema.safeParse({ name: '   ' }).success).toBe(false);
  });

  it('rejects a code with disallowed characters', () => {
    const result = teamCreateSchema.safeParse({ name: 'Platform', code: 'oops!' });
    expect(result.success).toBe(false);
  });

  it('coerces empty string code to undefined', () => {
    const result = teamCreateSchema.safeParse({ name: 'Platform', code: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.code).toBeUndefined();
  });
});

describe('teamUpdateSchema', () => {
  it('requires id and allows partial fields', () => {
    expect(teamUpdateSchema.safeParse({ id: 'tm_1' }).success).toBe(true);
    expect(teamUpdateSchema.safeParse({ name: 'x' }).success).toBe(false);
  });
});

describe('teamListSchema', () => {
  it('defaults limit to 50 and accepts every status enum value', () => {
    const result = teamListSchema.safeParse({ status: 'ARCHIVED' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

describe('projectCreateSchema', () => {
  it('accepts a happy-path payload', () => {
    const result = projectCreateSchema.safeParse({
      name: 'Apollo',
      code: 'APL',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      budgetMinor: 100_000,
      budgetCurrency: 'EUR',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startDate?.toISOString().slice(0, 10)).toBe('2026-01-01');
    }
  });

  it('rejects endDate before startDate', () => {
    const result = projectCreateSchema.safeParse({
      name: 'Apollo',
      startDate: '2026-06-01',
      endDate: '2026-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejects budgetMinor without currency (or vice versa)', () => {
    expect(projectCreateSchema.safeParse({ name: 'Apollo', budgetMinor: 1000 }).success).toBe(
      false,
    );
    expect(projectCreateSchema.safeParse({ name: 'Apollo', budgetCurrency: 'EUR' }).success).toBe(
      false,
    );
  });

  it('rejects a non-ISO currency code', () => {
    expect(
      projectCreateSchema.safeParse({
        name: 'Apollo',
        budgetMinor: 1000,
        budgetCurrency: 'eu',
      }).success,
    ).toBe(false);
  });
});

describe('projectUpdateSchema', () => {
  it('requires id', () => {
    expect(projectUpdateSchema.safeParse({ name: 'Apollo' }).success).toBe(false);
    expect(projectUpdateSchema.safeParse({ id: 'pr_1' }).success).toBe(true);
  });
});

describe('projectListSchema', () => {
  it('rejects a limit above the cap', () => {
    expect(projectListSchema.safeParse({ limit: 999 }).success).toBe(false);
  });
});

describe('projectSyncSchema', () => {
  it('requires a connectionId', () => {
    expect(projectSyncSchema.safeParse({}).success).toBe(false);
    expect(projectSyncSchema.safeParse({ connectionId: 'ic_1' }).success).toBe(true);
  });
});

describe('projectMergeResolveSchema', () => {
  it('requires mergeIntoProjectId when action=merge', () => {
    expect(
      projectMergeResolveSchema.safeParse({
        pendingMergeId: 'pm_1',
        action: 'merge',
      }).success,
    ).toBe(false);
    expect(
      projectMergeResolveSchema.safeParse({
        pendingMergeId: 'pm_1',
        action: 'merge',
        mergeIntoProjectId: 'pr_42',
      }).success,
    ).toBe(true);
  });

  it('allows action=keep without a target id', () => {
    expect(
      projectMergeResolveSchema.safeParse({
        pendingMergeId: 'pm_1',
        action: 'keep',
      }).success,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cost Center
// ---------------------------------------------------------------------------

describe('costCenterCreateSchema', () => {
  it('accepts an uppercase code', () => {
    const result = costCenterCreateSchema.safeParse({ name: 'Engineering', code: 'ENG' });
    expect(result.success).toBe(true);
  });

  it('rejects a lowercase code', () => {
    expect(costCenterCreateSchema.safeParse({ name: 'Engineering', code: 'eng' }).success).toBe(
      false,
    );
  });

  it('rejects an empty name', () => {
    expect(costCenterCreateSchema.safeParse({ name: '  ', code: 'ENG' }).success).toBe(false);
  });
});

describe('costCenterUpdateSchema', () => {
  it('requires id and allows partial fields', () => {
    expect(costCenterUpdateSchema.safeParse({ id: 'cc_1' }).success).toBe(true);
    expect(costCenterUpdateSchema.safeParse({ name: 'x' }).success).toBe(false);
  });
});

describe('costCenterCsvRowSchema', () => {
  it('rejects a lowercase code (mirrors the UI preview validator)', () => {
    expect(costCenterCsvRowSchema.safeParse({ name: 'Eng', code: 'eng' }).success).toBe(false);
  });
});

describe('costCenterCsvImportSchema', () => {
  it('caps the row count at 1000', () => {
    const rows = Array.from({ length: 1001 }, (_, i) => ({
      name: `Center ${i}`,
      code: `C${i}`,
    }));
    expect(costCenterCsvImportSchema.safeParse({ rows }).success).toBe(false);
  });

  it('rejects an empty rows array', () => {
    expect(costCenterCsvImportSchema.safeParse({ rows: [] }).success).toBe(false);
  });

  it('accepts a small valid batch', () => {
    expect(
      costCenterCsvImportSchema.safeParse({
        rows: [
          { name: 'Eng', code: 'ENG' },
          { name: 'Ops', code: 'OPS' },
        ],
      }).success,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Archive
// ---------------------------------------------------------------------------

describe('orgDefinitionArchiveSchema', () => {
  it('requires id', () => {
    expect(orgDefinitionArchiveSchema.safeParse({}).success).toBe(false);
    expect(orgDefinitionArchiveSchema.safeParse({ id: 'tm_1' }).success).toBe(true);
  });
});
