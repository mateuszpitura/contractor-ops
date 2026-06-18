// Schema test for the AuditLog append-only hardening migration.
//
// Asserts the migration enforces append-only at the DB layer: the prior
// `FOR ALL` write policy is dropped, INSERT stays allowed for ops-writers,
// UPDATE is blocked by a trigger, and DELETE is gated behind the
// transaction-local `app.allow_audit_purge` flag set only by the GDPR
// Right-to-Erasure path.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../prisma/schema/migrations/20260617000000_auditlog_append_only/migration.sql',
  ),
  'utf8',
);

describe('auditlog-append-only migration', () => {
  it('drops the over-broad FOR ALL auditlog_write policy', () => {
    expect(MIGRATION).toMatch(/drop policy if exists auditlog_write on "AuditLog"/);
    // No new FOR ALL policy may be reintroduced on AuditLog.
    expect(MIGRATION).not.toMatch(/create policy \w+ on "AuditLog"\s+for all/i);
  });

  it('creates an INSERT-only policy keeping the tenant + ops-writer predicate', () => {
    expect(MIGRATION).toMatch(
      /create policy auditlog_insert on "AuditLog"\s+for insert\s+with check \(app\.org_match\("organizationId"\) and app\.can_write_ops\(\)\)/,
    );
  });

  it('gates DELETE behind the purge flag (no ungated delete)', () => {
    expect(MIGRATION).toMatch(/create policy auditlog_delete on "AuditLog"\s+for delete/);
    expect(MIGRATION).toMatch(/app\.audit_purge_allowed\(\)/);
    expect(MIGRATION).toMatch(/current_setting\('app\.allow_audit_purge', true\)/);
  });

  it('defines no UPDATE policy and blocks UPDATE with a BEFORE UPDATE trigger', () => {
    // RLS deny-by-default: there must be no UPDATE policy on the table.
    expect(MIGRATION).not.toMatch(/create policy \w+ on "AuditLog"\s+for update/i);
    expect(MIGRATION).toMatch(/create trigger auditlog_no_update\s+before update on "AuditLog"/);
    expect(MIGRATION).toMatch(/raise exception 'AuditLog is append-only: UPDATE is not permitted'/);
  });
});
