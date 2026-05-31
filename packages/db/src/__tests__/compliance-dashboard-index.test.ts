// Phase 73 · Plan 02 — Schema test for D-02 dashboard "At risk" composite index.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SCHEMA = fs.readFileSync(
  path.resolve(__dirname, '../../prisma/schema/contractor.prisma'),
  'utf8',
);
const MIGRATION = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../prisma/schema/migrations/20260428000000_phase_73_compliance_dashboard_overrides_pending_review/migration.sql',
  ),
  'utf8',
);

describe('compliance-dashboard-index', () => {
  it('ContractorComplianceItem declares @@index([organizationId, severity, status, expiresAt])', () => {
    expect(SCHEMA).toMatch(/@@index\(\[organizationId, severity, status, expiresAt\]\)/);
  });

  it('migration creates ContractorComplianceItem_organizationId_severity_status_expiresAt_idx', () => {
    expect(MIGRATION).toMatch(
      /CREATE INDEX "ContractorComplianceItem_organizationId_severity_status_expiresAt_idx"/,
    );
  });
});
