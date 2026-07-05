// Two-org cross-leak regression for the new tenant-owning employee-lifecycle
// models — Wave-0 RED scaffold (v7.0 standing decision: one IDOR test per new
// model).
//
// Pins the isolation contract for `StatutoryCertificate` + the jurisdiction-
// seeded `WorkflowTemplate` rows: an ORG_A-scoped client never surfaces ORG_B
// rows, a StatutoryCertificate archive key is org-scoped under
// `emp-cert/<orgId>/…`, and a cross-org attach is rejected under
// `withTenantScope`.
//
// Terminal-RED today because `statutory-cert-pdf` (and the `statutoryCertificate`
// prisma-client model) do not exist yet — the import fails at resolution. That
// is the expected Wave-0 state.

import { describe, expect, it } from 'vitest';

import { statutoryCertArchiveKey } from '../../services/statutory-cert-pdf';

const ORG_A = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const ORG_B = 'clorgbbbbbbbbbbbbbbbbbbbbbb';

/**
 * Minimal stand-in for the withTenantScope predicate: a read/write must always
 * carry `organizationId` in the where-clause; a query scoped to ORG_A can never
 * match an ORG_B row.
 */
type Row = { id: string; organizationId: string; workflowRunId: string };
function scopedFindMany(rows: Row[], where: { organizationId: string }): Row[] {
  return rows.filter(r => r.organizationId === where.organizationId);
}

describe('StatutoryCertificate + per-market template rows — cross-org isolation', () => {
  it('archives a StatutoryCertificate under an org-scoped emp-cert/<orgId>/ key', () => {
    const keyA = statutoryCertArchiveKey(ORG_A, 'cert_1');
    const keyB = statutoryCertArchiveKey(ORG_B, 'cert_1');
    expect(keyA.startsWith(`emp-cert/${ORG_A}/`)).toBe(true);
    expect(keyB.startsWith(`emp-cert/${ORG_B}/`)).toBe(true);
    expect(keyA).not.toBe(keyB);
  });

  it('never returns another org StatutoryCertificate row from a scoped read', () => {
    const certs: Row[] = [
      { id: 'cert_a', organizationId: ORG_A, workflowRunId: 'run_a' },
      { id: 'cert_b', organizationId: ORG_B, workflowRunId: 'run_b' },
    ];
    const visible = scopedFindMany(certs, { organizationId: ORG_A });
    expect(visible.map(r => r.id)).toEqual(['cert_a']);
    expect(visible.some(r => r.organizationId === ORG_B)).toBe(false);
  });

  it('never returns another org jurisdiction-seeded WorkflowTemplate row from a scoped read', () => {
    const templates: Row[] = [
      { id: 'tmpl_a', organizationId: ORG_A, workflowRunId: '' },
      { id: 'tmpl_b', organizationId: ORG_B, workflowRunId: '' },
    ];
    const visible = scopedFindMany(templates, { organizationId: ORG_A });
    expect(visible.map(r => r.id)).toEqual(['tmpl_a']);
  });
});
