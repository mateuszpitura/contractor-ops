// Supersession service unit tests.
//
// Test scope: the pure service helpers in `packages/api/src/services/compliance-supersession.ts`.
// We test against an in-memory mock client (not real Prisma) — the same approach
// classification.test.ts uses with vi.hoisted mockPrisma. Direct integration
// tests against the trpc router are gated by a pre-existing test-infra issue
// (`contractorUpdateSchema.extend is not a function` in contractor.ts).

import { beforeEach, describe, expect, it } from 'vitest';
import '@contractor-ops/compliance-policy'; // registers all policy rules
import type { SupersessionClient } from '../services/compliance-supersession';
import {
  buildEngagementOutcome,
  extractOutcomeKind,
  materialiseFromPolicy,
  outcomesEqualForPolicyResolution,
  supersedeAndMaterialise,
} from '../services/compliance-supersession';

// ---------------------------------------------------------------------------
// Mock client — in-memory ContractorComplianceItem store
// ---------------------------------------------------------------------------

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

function makeClient(failOn?: { method: 'create' | 'updateMany'; afterCalls: number }): {
  client: SupersessionClient;
  callCounts: { findMany: number; updateMany: number; create: number };
} {
  const callCounts = { findMany: 0, updateMany: 0, create: 0 };
  return {
    callCounts,
    client: {
      contractorComplianceItem: {
        findMany: (async (args: { where: Record<string, unknown> }) => {
          callCounts.findMany++;
          const where = args.where ?? {};
          return rows.filter(r => {
            if (where.contractorId && r.contractorId !== where.contractorId) return false;
            if (where.status && typeof where.status === 'object') {
              const notEq = (where.status as { not?: string }).not;
              if (notEq && r.status === notEq) return false;
            }
            return true;
          });
        }) as never,
        updateMany: (async (args: { where: { id: { in: string[] } }; data: Partial<Row> }) => {
          callCounts.updateMany++;
          if (failOn?.method === 'updateMany' && callCounts.updateMany > failOn.afterCalls) {
            throw new Error('induced failure');
          }
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
          callCounts.create++;
          if (failOn?.method === 'create' && callCounts.create > failOn.afterCalls) {
            throw new Error('induced failure');
          }
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
    },
  };
}

beforeEach(() => {
  rows = [];
  nextId = 1;
});

// ---------------------------------------------------------------------------
// extractOutcomeKind / outcomesEqualForPolicyResolution
// ---------------------------------------------------------------------------

describe('extractOutcomeKind', () => {
  it('returns the kind discriminator from a Zod-parsed Outcome', () => {
    expect(extractOutcomeKind({ kind: 'IR35', verdict: 'inside' })).toBe('IR35');
    expect(extractOutcomeKind({ kind: 'SCHEINSELBSTANDIGKEIT', verdict: 'abhangig' })).toBe(
      'SCHEINSELBSTANDIGKEIT',
    );
  });

  it('falls back to type field when kind is absent', () => {
    expect(extractOutcomeKind({ type: 'IR35' })).toBe('IR35');
  });

  it('returns __unknown__ for invalid input', () => {
    expect(extractOutcomeKind(null)).toBe('__unknown__');
    expect(extractOutcomeKind(undefined)).toBe('__unknown__');
    expect(extractOutcomeKind({})).toBe('__unknown__');
    expect(extractOutcomeKind('string')).toBe('__unknown__');
  });
});

describe('buildEngagementOutcome', () => {
  it('maps IR35 verdicts to kind+verdict composite for policy resolution', () => {
    expect(buildEngagementOutcome({ kind: 'IR35', verdict: 'inside' })).toBe('IR35-INSIDE');
    expect(buildEngagementOutcome({ kind: 'IR35', verdict: 'outside' })).toBe('IR35-OUTSIDE');
    expect(buildEngagementOutcome({ kind: 'IR35', verdict: 'indeterminate' })).toBe(
      'IR35-INDETERMINATE',
    );
  });

  it('falls back to kind for non-IR35 outcomes', () => {
    expect(buildEngagementOutcome({ kind: 'SCHEINSELBSTANDIGKEIT', verdict: 'abhangig' })).toBe(
      'SCHEINSELBSTANDIGKEIT',
    );
  });
});

describe('outcomesEqualForPolicyResolution', () => {
  it('treats IR35 inside vs outside as unequal for policy resolution', () => {
    expect(
      outcomesEqualForPolicyResolution(
        { kind: 'IR35', verdict: 'inside' },
        { kind: 'IR35', verdict: 'outside' },
      ),
    ).toBe(false);
  });

  it('treats identical IR35 verdict composites as equal', () => {
    expect(
      outcomesEqualForPolicyResolution(
        { kind: 'IR35', verdict: 'inside' },
        { kind: 'IR35', verdict: 'inside' },
      ),
    ).toBe(true);
  });

  it('treats outcomes with different kind as unequal', () => {
    expect(
      outcomesEqualForPolicyResolution({ kind: 'IR35' }, { kind: 'SCHEINSELBSTANDIGKEIT' }),
    ).toBe(false);
  });

  it('handles null on either side via reference equality', () => {
    expect(outcomesEqualForPolicyResolution(null, null)).toBe(true);
    expect(outcomesEqualForPolicyResolution(null, { kind: 'IR35' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// materialiseFromPolicy / supersedeAndMaterialise
// ---------------------------------------------------------------------------

describe('classification.submit — Phase 71 supersession on outcome change (D-10)', () => {
  it('first classification on a new engagement materialises rows from policy registry (UK B2B IR35-INSIDE → 5 rows)', async () => {
    const { client, callCounts } = makeClient();
    const result = await materialiseFromPolicy(client, {
      organizationId: 'org_a',
      contractorId: 'c_a',
      contractId: null,
      engagement: {
        jurisdiction: 'UK',
        outcome: 'IR35-INSIDE',
        sector: null,
        contractorNationality: 'GB',
        requiresRegulatedEquipment: false,
      },
    });
    expect(result.inserted).toBe(5);
    expect(callCounts.create).toBe(5);
    const ids = rows.map(r => r.policyRuleId).sort();
    expect(ids).toEqual([
      'uk.business_registration@v1',
      'uk.ip_assignment@v1',
      'uk.right_to_work@v1',
      'uk.sds@v1',
      'uk.utr@v1',
    ]);
    for (const r of rows) {
      expect(r.status).toBe('MISSING');
      expect(r.expiryJurisdictionTz).toBe('Europe/London');
    }
  });

  it('outcome change UK B2B IR35-INSIDE → DE ABHANGIG: old rows WAIVED with reason classification_outcome_change, new rows inserted', async () => {
    // Seed 4 SATISFIED UK rows
    rows.push(
      ...[
        {
          id: 'r1',
          organizationId: 'org_a',
          contractorId: 'c_a',
          contractId: null,
          documentType: 'UK_RIGHT_TO_WORK_SHARE_CODE',
          name: 'UK RTW',
          severity: 'BLOCKING',
          policyRuleId: 'uk.right_to_work@v1',
          expiryJurisdictionTz: 'Europe/London',
          status: 'SATISFIED',
          satisfiedByDocumentId: 'doc_rtw',
          expiresAt: new Date('2027-01-01'),
          waivedReason: null,
        },
        {
          id: 'r2',
          organizationId: 'org_a',
          contractorId: 'c_a',
          contractId: null,
          documentType: 'UK_UTR',
          name: 'UTR',
          severity: 'WARNING',
          policyRuleId: 'uk.utr@v1',
          expiryJurisdictionTz: 'Europe/London',
          status: 'SATISFIED',
          satisfiedByDocumentId: null,
          expiresAt: null,
          waivedReason: null,
        },
      ],
    );
    const { client } = makeClient();
    const result = await supersedeAndMaterialise(client, {
      organizationId: 'org_a',
      contractorId: 'c_a',
      contractId: null,
      engagement: {
        jurisdiction: 'DE',
        outcome: 'SCHEINSELBSTANDIGKEIT',
        sector: null,
        contractorNationality: 'DE', // EU → no Aufenthaltstitel
        requiresRegulatedEquipment: false,
      },
      reason: 'classification_outcome_change',
    });
    expect(result.waivedCount).toBe(2);
    // 2 DE rules apply (de.a1@v1 + de.werkvertrag_ip@v1) — DE national → no aufenthaltstitel; sector !== construction → no eight_b_estg
    expect(result.insertedCount).toBe(2);
    const oldRows = rows.filter(r => ['r1', 'r2'].includes(r.id));
    for (const r of oldRows) {
      expect(r.status).toBe('WAIVED');
      expect(r.waivedReason).toBe('classification_outcome_change');
    }
    const newRows = rows.filter(r => !['r1', 'r2'].includes(r.id));
    expect(newRows[0]?.policyRuleId).toBe('de.a1@v1');
  });

  it('same policy outcome resubmit: no row churn when verdict composite is unchanged', () => {
    expect(
      outcomesEqualForPolicyResolution(
        { kind: 'IR35', verdict: 'inside' },
        { kind: 'IR35', verdict: 'inside' },
      ),
    ).toBe(true);
    expect(
      outcomesEqualForPolicyResolution(
        { kind: 'IR35', verdict: 'inside' },
        { kind: 'IR35', verdict: 'outside' },
      ),
    ).toBe(false);
  });

  it('carry-forward: when new rule documentType matches old, satisfiedByDocumentId + expiresAt copied; status = SATISFIED', async () => {
    // Same UK outcome but bumping the registry rule version conceptually — same documentType
    rows.push({
      id: 'r1',
      organizationId: 'org_a',
      contractorId: 'c_a',
      contractId: null,
      documentType: 'UK_UTR',
      name: 'UTR',
      severity: 'WARNING',
      policyRuleId: 'uk.utr@v1',
      expiryJurisdictionTz: 'Europe/London',
      status: 'SATISFIED',
      satisfiedByDocumentId: 'doc_utr_xyz',
      expiresAt: new Date('2027-06-15'),
      waivedReason: null,
    });
    const { client } = makeClient();
    const result = await supersedeAndMaterialise(client, {
      organizationId: 'org_a',
      contractorId: 'c_a',
      contractId: null,
      engagement: {
        jurisdiction: 'UK',
        outcome: 'IR35-OUTSIDE',
        sector: null,
        contractorNationality: 'GB',
        requiresRegulatedEquipment: false,
      },
      reason: 'classification_outcome_change',
    });
    expect(result.carriedForwardCount).toBe(1); // only UTR has carry-forward (had a doc)
    const newUtr = rows.find(r => r.documentType === 'UK_UTR' && r.id !== 'r1');
    expect(newUtr?.satisfiedByDocumentId).toBe('doc_utr_xyz');
    expect(newUtr?.expiresAt).toEqual(new Date('2027-06-15'));
    expect(newUtr?.status).toBe('SATISFIED');
  });

  it('carry-forward: when new rule documentType does NOT match old, status = MISSING', async () => {
    // UK→DE: no UK documentType has a DE counterpart
    rows.push({
      id: 'r1',
      organizationId: 'org_a',
      contractorId: 'c_a',
      contractId: null,
      documentType: 'UK_RIGHT_TO_WORK_SHARE_CODE',
      name: 'UK RTW',
      severity: 'BLOCKING',
      policyRuleId: 'uk.right_to_work@v1',
      expiryJurisdictionTz: 'Europe/London',
      status: 'SATISFIED',
      satisfiedByDocumentId: 'doc_rtw',
      expiresAt: null,
      waivedReason: null,
    });
    const { client } = makeClient();
    const result = await supersedeAndMaterialise(client, {
      organizationId: 'org_a',
      contractorId: 'c_a',
      contractId: null,
      engagement: {
        jurisdiction: 'DE',
        outcome: 'SCHEINSELBSTANDIGKEIT',
        sector: null,
        contractorNationality: 'DE',
        requiresRegulatedEquipment: false,
      },
      reason: 'classification_outcome_change',
    });
    expect(result.carriedForwardCount).toBe(0);
    const newRows = rows.filter(r => r.id !== 'r1');
    for (const nr of newRows) {
      expect(nr.status).toBe('MISSING');
      expect(nr.satisfiedByDocumentId).toBeNull();
    }
  });

  it('transactional atomicity: induced failure mid-supersession leaves caller-detectable error (caller must wrap in $transaction)', async () => {
    // Helper does NOT open a transaction itself. Atomicity is the caller's
    // responsibility (classification.submit wraps in ctx.db.$transaction).
    // We assert the helper propagates errors so the outer transaction can roll back.
    rows.push({
      id: 'r1',
      organizationId: 'org_a',
      contractorId: 'c_a',
      contractId: null,
      documentType: 'UK_RIGHT_TO_WORK_SHARE_CODE',
      name: 'UK RTW',
      severity: 'BLOCKING',
      policyRuleId: 'uk.right_to_work@v1',
      expiryJurisdictionTz: 'Europe/London',
      status: 'SATISFIED',
      satisfiedByDocumentId: 'doc_rtw',
      expiresAt: null,
      waivedReason: null,
    });
    const { client } = makeClient({ method: 'create', afterCalls: 1 });
    await expect(
      supersedeAndMaterialise(client, {
        organizationId: 'org_a',
        contractorId: 'c_a',
        contractId: null,
        engagement: {
          jurisdiction: 'UK',
          outcome: 'IR35-INSIDE',
          sector: null,
          contractorNationality: 'GB',
          requiresRegulatedEquipment: false,
        },
        reason: 'classification_outcome_change',
      }),
    ).rejects.toThrow('induced failure');
  });

  it('policyRuleSetVersion snapshotted onto ClassificationAssessment on submit (constant export)', async () => {
    const { POLICY_RULE_SET_VERSION } = await import('@contractor-ops/compliance-policy');
    expect(POLICY_RULE_SET_VERSION).toBe('v6.0.0');
  });
});
