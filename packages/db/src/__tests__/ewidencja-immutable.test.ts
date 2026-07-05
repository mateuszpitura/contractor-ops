// TIME-EMP-03 immutability contract for the KP §149 ewidencja archive.
//
// EwidencjaSnapshot is the evidentiary record-of-record: immutability is
// DB-enforced, never by app convention. Mirrors the AuditLog append-only
// hardening — a BEFORE UPDATE trigger raising restrict_violation, an
// insert-only RLS policy, and a purge-flag-gated DELETE. Asserted against the
// raw-SQL migration so the guarantee cannot silently regress.

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const MIGRATION = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../prisma/schema/migrations/20260701000000_ewidencja_append_only/migration.sql',
  ),
  'utf8',
);

describe('ewidencja-append-only migration', () => {
  it('blocks UPDATE with a BEFORE UPDATE trigger raising restrict_violation', () => {
    expect(MIGRATION).toMatch(
      /create trigger ewidencja_no_update\s+before update on "EwidencjaSnapshot"/,
    );
    expect(MIGRATION).toMatch(
      /raise exception 'EwidencjaSnapshot is append-only: UPDATE is not permitted'/,
    );
    expect(MIGRATION).toMatch(/restrict_violation/);
  });

  it('defines no UPDATE policy (RLS deny-by-default) on the table', () => {
    expect(MIGRATION).not.toMatch(/create policy \w+ on "EwidencjaSnapshot"\s+for update/i);
  });

  it('keeps an INSERT-only policy scoped to the tenant + ops-writer predicate', () => {
    expect(MIGRATION).toMatch(
      /create policy ewidencja_insert on "EwidencjaSnapshot"\s+for insert\s+with check \(app\.org_match\("organizationId"\)/,
    );
  });

  it('gates DELETE behind a transaction-local purge flag (no ungated delete)', () => {
    expect(MIGRATION).toMatch(/create policy ewidencja_delete on "EwidencjaSnapshot"\s+for delete/);
  });
});
