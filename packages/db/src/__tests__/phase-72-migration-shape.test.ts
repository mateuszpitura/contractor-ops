// Migration shape regression test.
// Reads each compliance-reminder migration.sql and asserts the required SQL
// constructs are present. Locks the contract so a future schema-pull or merge
// cannot silently drop the GIN index, an enum value, or a foreign-key cascade.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../prisma/schema/migrations');

function read(dir: string): string {
  return readFileSync(resolve(root, dir, 'migration.sql'), 'utf8');
}

describe('Phase 72 Migration A — compliance reminder state', () => {
  const sql = read('20260531170000_phase72_compliance_reminder_state');
  it('creates ReminderBand enum with all 7 values', () => {
    expect(sql).toMatch(
      /CREATE TYPE "ReminderBand" AS ENUM \('NONE', 'D90', 'D60', 'D30', 'D15', 'D7', 'EXPIRED'\)/,
    );
  });
  it('creates ContractorComplianceReminderState table with itemId @unique pkey', () => {
    expect(sql).toMatch(/CREATE TABLE "ContractorComplianceReminderState"/);
    expect(sql).toMatch(/PRIMARY KEY \("itemId"\)/);
  });
  it('cascades on item delete', () => {
    expect(sql).toMatch(/ON DELETE CASCADE/);
  });
});

describe('Phase 72 Migration B — approval compliance holds', () => {
  const sql = read('20260531170001_phase72_approval_compliance_holds');
  it('adds PENDING_COMPLIANCE enum value AFTER PENDING', () => {
    expect(sql).toMatch(
      /ALTER TYPE "ApprovalStatus" ADD VALUE 'PENDING_COMPLIANCE' AFTER 'PENDING'/,
    );
  });
  it('adds complianceHoldsJson JSONB column', () => {
    expect(sql).toMatch(/ALTER TABLE "ApprovalFlow" ADD COLUMN "complianceHoldsJson" JSONB/);
  });
  it('creates GIN index with jsonb_path_ops operator class', () => {
    expect(sql).toMatch(
      /CREATE INDEX "ApprovalFlow_complianceHoldsJson_gin_idx"\s+ON "ApprovalFlow" USING GIN \("complianceHoldsJson" jsonb_path_ops\)/,
    );
  });
});

describe('Phase 72 Migration C — payment run compliance check', () => {
  const sql = read('20260531170002_phase72_payment_run_compliance_check');
  it('creates EligibilityVerdict enum with PASS, FAIL', () => {
    expect(sql).toMatch(/CREATE TYPE "EligibilityVerdict" AS ENUM \('PASS', 'FAIL'\)/);
  });
  it('creates PaymentRunComplianceCheck table', () => {
    expect(sql).toMatch(/CREATE TABLE "PaymentRunComplianceCheck"/);
  });
  it('paymentExportId FK uses ON DELETE SET NULL (audit row preserved when export deleted)', () => {
    expect(sql).toMatch(/PaymentRunComplianceCheck_paymentExportId_fkey.*?ON DELETE SET NULL/s);
  });
  it('contractor + snapshottedAt index uses DESC sort for "recent first" queries', () => {
    expect(sql).toMatch(/contractorId_snapshottedAt_idx.*?"snapshottedAt" DESC/s);
  });
});
