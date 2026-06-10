// Schema test for compliance override columns.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SCHEMA = fs.readFileSync(
  path.resolve(__dirname, '../../prisma/schema/contractor.prisma'),
  'utf8',
);

describe('compliance-override-columns', () => {
  it('declares enum WaivedReasonCategory with all 6 UPPER_SNAKE_CASE values', () => {
    const block = SCHEMA.match(/enum WaivedReasonCategory \{([^}]+)\}/);
    expect(block, 'WaivedReasonCategory enum not found').not.toBeNull();
    const values = ((block as RegExpMatchArray)[1] as string).match(/\b[A-Z][A-Z0-9_]*\b/g) ?? [];
    expect(values).toEqual(
      expect.arrayContaining([
        'CONTRACTOR_OFFBOARDED',
        'ENGAGEMENT_CHANGED',
        'REGULATORY_EXEMPTION',
        'TEMPORARY_GRACE_PERIOD',
        'ADMIN_CORRECTION',
        'OTHER',
      ]),
    );
  });

  it('ContractorComplianceItem model has waivedReasonCategory + waivedReasonNote columns', () => {
    expect(SCHEMA).toMatch(/waivedReasonCategory\s+WaivedReasonCategory\?/);
    expect(SCHEMA).toMatch(/waivedReasonNote\s+String\?/);
  });
});
