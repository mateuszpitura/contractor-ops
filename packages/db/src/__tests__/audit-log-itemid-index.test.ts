// Schema test for the partial GIN index on AuditLog.metadataJson.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../prisma/schema/migrations/20260428000000_phase_73_compliance_dashboard_overrides_pending_review/migration.sql',
  ),
  'utf8',
);

describe('audit-log-itemid-index', () => {
  it('migration creates partial GIN index AuditLog_metadata_itemId_idx WHERE resourceType=CONTRACTOR', () => {
    expect(MIGRATION).toMatch(
      /CREATE INDEX "AuditLog_metadata_itemId_idx"\s+ON "AuditLog" USING GIN \("metadataJson"\)\s+WHERE "resourceType" = 'CONTRACTOR'/,
    );
  });
});
