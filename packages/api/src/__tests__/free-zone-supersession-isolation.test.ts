// Phase 79 Wave 2 — GREEN (was Wave 0 RED scaffold).
//
// Critical behavior C4 (GULF-01/02, Pitfall 2): a free-zone
// `ContractorComplianceItem` written out-of-band from the FreeZoneAssignment
// service path SURVIVES `supersedeAndMaterialise` (it is NOT WAIVED) after an
// unrelated classification recompute for the same contractor.
//
// LANDMINE: supersedeAndMaterialise WAIVES every non-WAIVED row not re-emitted
// by resolvePolicyRules(engagement). Free-zone rows are keyed off
// FreeZoneAssignment, not the classification outcome, so the supersession scope
// EXCLUDES them via `policyRuleId NOT startsWith 'uae.free_zone'` — otherwise the
// free-zone item silently flips to WAIVED.
//
// Analog: packages/api/src/__tests__/classification-supersession.test.ts.

import { beforeEach, describe, expect, it } from 'vitest';
import '@contractor-ops/compliance-policy'; // register all policy rules (incl. uae.free_zone_license@v2)
import type { SupersessionClient } from '../services/compliance-supersession';
import { supersedeAndMaterialise } from '../services/compliance-supersession';

type Row = {
  id: string;
  organizationId: string;
  contractorId: string;
  contractId: string | null;
  documentType: string;
  name: string;
  severity: string | null;
  policyRuleId: string | null;
  expiryJurisdictionTz: string | null;
  status: string;
  satisfiedByDocumentId: string | null;
  expiresAt: Date | null;
  waivedReason: string | null;
};

let rows: Row[] = [];
let nextId = 1;

function seedRow(over: Partial<Row>): Row {
  const row: Row = {
    id: `seed_${nextId++}`,
    organizationId: 'org_me',
    contractorId: 'c_me',
    contractId: null,
    documentType: 'UNKNOWN',
    name: 'seed',
    severity: 'WARNING',
    policyRuleId: null,
    expiryJurisdictionTz: null,
    status: 'PENDING',
    satisfiedByDocumentId: null,
    expiresAt: null,
    waivedReason: null,
    ...over,
  };
  rows.push(row);
  return row;
}

function startsWith(value: string | null, prefix: string): boolean {
  return typeof value === 'string' && value.startsWith(prefix);
}

/** Mock client honouring the contractorId + status.not + NOT[policyRuleId.startsWith] filter. */
function makeClient(): SupersessionClient {
  return {
    contractorComplianceItem: {
      findMany: (async (args: { where: Record<string, unknown> }) => {
        const where = args.where ?? {};
        return rows.filter(r => {
          if (where.contractorId && r.contractorId !== where.contractorId) return false;
          const status = where.status as { not?: string } | undefined;
          if (status?.not && r.status === status.not) return false;
          // Phase 79 — the out-of-band advisory exclusions the service adds as a
          // NOT array (free-zone licenses + permitted-activity NOC advisories).
          const notClauses =
            (where.NOT as Array<{ policyRuleId?: { startsWith?: string } }> | undefined) ?? [];
          for (const clause of notClauses) {
            const prefix = clause.policyRuleId?.startsWith;
            if (prefix && startsWith(r.policyRuleId, prefix)) return false;
          }
          return true;
        });
      }) as never,
      updateMany: (async (args: { where: { id: { in: string[] } }; data: Partial<Row> }) => {
        let count = 0;
        for (const row of rows) {
          if (args.where.id.in.includes(row.id)) {
            Object.assign(row, args.data);
            count++;
          }
        }
        return { count };
      }) as never,
      create: (async (args: { data: Partial<Row> }) => {
        const row: Row = {
          id: `cl_row_${nextId++}`,
          organizationId: args.data.organizationId ?? '',
          contractorId: args.data.contractorId ?? '',
          contractId: args.data.contractId ?? null,
          documentType: args.data.documentType ?? '',
          name: args.data.name ?? '',
          severity: args.data.severity ?? null,
          policyRuleId: args.data.policyRuleId ?? null,
          expiryJurisdictionTz: args.data.expiryJurisdictionTz ?? null,
          status: args.data.status ?? 'MISSING',
          satisfiedByDocumentId: args.data.satisfiedByDocumentId ?? null,
          expiresAt: args.data.expiresAt ?? null,
          waivedReason: args.data.waivedReason ?? null,
        };
        rows.push(row);
        return row;
      }) as never,
    },
  };
}

const UK_ENGAGEMENT = {
  jurisdiction: 'UK' as const,
  outcome: 'IR35-INSIDE',
  sector: null,
  contractorNationality: 'GB',
  requiresRegulatedEquipment: false,
};

beforeEach(() => {
  rows = [];
  nextId = 1;
});

describe('C4 (Pitfall 2) free-zone item survives supersession — not orphaned/WAIVED', () => {
  it('leaves the free-zone BLOCKING item status unchanged after an unrelated classification recompute calls supersedeAndMaterialise [79-03]', async () => {
    const freeZone = seedRow({
      documentType: 'UAE_FREE_ZONE_LICENSE',
      name: 'UAE Free-Zone Trade License',
      severity: 'BLOCKING',
      policyRuleId: 'uae.free_zone_license@v2',
      status: 'EXPIRED',
      expiresAt: new Date('2026-04-01T00:00:00Z'),
    });
    // A classification-outcome row that SHOULD be superseded.
    seedRow({ documentType: 'A1_CERTIFICATE', policyRuleId: 'de.a1@v1', status: 'MISSING' });

    await supersedeAndMaterialise(makeClient(), {
      organizationId: 'org_me',
      contractorId: 'c_me',
      contractId: null,
      engagement: UK_ENGAGEMENT,
      reason: 'CLASSIFICATION_OUTCOME_CHANGE',
    });

    const after = rows.find(r => r.id === freeZone.id);
    expect(after?.status).toBe('EXPIRED'); // unchanged — NOT WAIVED
    expect(after?.waivedReason).toBeNull();
  });

  it('excludes uae.free_zone_license@v2 rows from the supersession WAIVE scope [79-03]', async () => {
    seedRow({
      documentType: 'UAE_FREE_ZONE_LICENSE',
      severity: 'BLOCKING',
      policyRuleId: 'uae.free_zone_license@v2',
      status: 'PENDING',
    });

    const result = await supersedeAndMaterialise(makeClient(), {
      organizationId: 'org_me',
      contractorId: 'c_me',
      contractId: null,
      engagement: UK_ENGAGEMENT,
      reason: 'CLASSIFICATION_OUTCOME_CHANGE',
    });

    // The free-zone row is invisible to the WAIVE scope, so waivedCount is 0.
    expect(result.waivedCount).toBe(0);
    const freeZoneRows = rows.filter(r => startsWith(r.policyRuleId, 'uae.free_zone'));
    expect(freeZoneRows.every(r => r.status !== 'WAIVED')).toBe(true);
  });

  it('excludes uae.permitted_activity_noc@v1 advisories from the supersession WAIVE scope (WR-03) [79-gap]', async () => {
    // A permitted-activity NOC advisory is written out-of-band by the contract-create
    // scope check, keyed off the engagement — NOT the classification outcome. An
    // unrelated classification recompute on the same contractor (even a different
    // engagement) must not silently WAIVE it.
    const noc = seedRow({
      documentType: 'NOC',
      name: 'Permitted-activity scope mismatch',
      severity: 'WARNING',
      policyRuleId: 'uae.permitted_activity_noc@v1',
      status: 'MISSING',
    });

    const result = await supersedeAndMaterialise(makeClient(), {
      organizationId: 'org_me',
      contractorId: 'c_me',
      contractId: null,
      engagement: UK_ENGAGEMENT,
      reason: 'CLASSIFICATION_OUTCOME_CHANGE',
    });

    // The NOC advisory is invisible to the WAIVE scope, so waivedCount is 0.
    expect(result.waivedCount).toBe(0);
    const after = rows.find(r => r.id === noc.id);
    expect(after?.status).toBe('MISSING'); // unchanged — NOT WAIVED
    expect(after?.waivedReason).toBeNull();
  });

  it('still WAIVES genuinely superseded classification-outcome rows (no over-exclusion) [79-03]', async () => {
    const classRow = seedRow({
      documentType: 'A1_CERTIFICATE',
      policyRuleId: 'de.a1@v1',
      status: 'MISSING',
    });
    seedRow({
      documentType: 'UAE_FREE_ZONE_LICENSE',
      policyRuleId: 'uae.free_zone_license@v2',
      severity: 'BLOCKING',
      status: 'EXPIRED',
    });

    const result = await supersedeAndMaterialise(makeClient(), {
      organizationId: 'org_me',
      contractorId: 'c_me',
      contractId: null,
      engagement: UK_ENGAGEMENT,
      reason: 'CLASSIFICATION_OUTCOME_CHANGE',
    });

    // The de.a1 classification row WAS waived; the free-zone row was not counted.
    expect(result.waivedCount).toBe(1);
    expect(rows.find(r => r.id === classRow.id)?.status).toBe('WAIVED');
  });
});
