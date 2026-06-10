// A contract whose ISIC activity code is NOT in the contractor's free-zone
// permitted code set fires a non-blocking scope-mismatch advisory AND
// auto-creates a WARNING NOC `ContractorComplianceItem` for the affected
// engagement. An uncoded contract (no activityIsicCodes) produces no advisory
// and no NOC (skip-on-uncoded; no MANUAL_REVIEW tristate).
//
// Deterministic ISIC-code overlap, not fuzzy text matching. Contract creation
// still proceeds — the advisory is non-gating.
//
// Fixtures: makeFreeZoneAssignment({ permittedActivityIsicCodes: [...] }) from
// packages/api/src/__tests__/__fixtures__/gulf-fixtures.ts.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFreeZoneAssignment, makeMeOrg } from './__fixtures__/gulf-fixtures';

vi.mock('@contractor-ops/logger', () => ({
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

import type { PermittedActivityClient } from '../services/permitted-activity-check';
import {
  checkPermittedActivityScope,
  NOC_DOCUMENT_TYPE,
  NOC_POLICY_RULE_ID,
} from '../services/permitted-activity-check';

const ME_ORG = makeMeOrg();
const CONTRACT_ID = 'cl_contract_aaaaaaaaaaaaaaaa';

interface ItemRow {
  id: string;
  organizationId: string;
  contractorId: string;
  contractId: string | null;
  documentType: string;
  name: string;
  policyRuleId: string | null;
  severity: string | null;
  status: string;
}

let items: ItemRow[] = [];
let audits: Array<{ data: Record<string, unknown> }> = [];
let nextId = 1;

/** In-memory structural client mirroring the free-zone-compliance test's makeClient. */
function makeClient(): PermittedActivityClient {
  return {
    contractorComplianceItem: {
      create: (async (args: { data: Partial<ItemRow> }) => {
        const row: ItemRow = {
          id: `cl_item_${nextId++}`,
          organizationId: args.data.organizationId ?? '',
          contractorId: args.data.contractorId ?? '',
          contractId: args.data.contractId ?? null,
          documentType: args.data.documentType ?? 'OTHER',
          name: args.data.name ?? '',
          policyRuleId: args.data.policyRuleId ?? null,
          severity: args.data.severity ?? null,
          status: args.data.status ?? 'MISSING',
        };
        items.push(row);
        return row;
      }) as never,
    },
    auditLog: {
      create: (async (args: { data: Record<string, unknown> }) => {
        audits.push(args);
        return args.data;
      }) as never,
      createMany: (async () => ({ count: 0 })) as never,
    },
  };
}

beforeEach(() => {
  items = [];
  audits = [];
  nextId = 1;
});

describe('C5 (GULF-03, D-05..08) permitted-activity scope-mismatch + auto-NOC', () => {
  it('fires the advisory + creates a WARNING NOC item when the contract ISIC code is outside the permitted set [79-04]', async () => {
    const client = makeClient();
    const assignment = makeFreeZoneAssignment({
      organizationId: ME_ORG.id,
      permittedActivityIsicCodes: ['6201', '6202'], // software / consultancy
    });

    const result = await checkPermittedActivityScope(client, {
      organizationId: ME_ORG.id,
      contractorId: assignment.contractorId,
      contractId: CONTRACT_ID,
      permittedActivityIsicCodes: assignment.permittedActivityIsicCodes,
      contractActivityIsicCodes: ['4520'], // motor-vehicle repair — no overlap
    });

    expect(result).toEqual({ mismatch: true, nocItemCreated: true });
    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item?.severity).toBe('WARNING'); // surfaced as advisory, not payment-blocking
    expect(item?.documentType).toBe(NOC_DOCUMENT_TYPE);
    expect(item?.policyRuleId).toBe(NOC_POLICY_RULE_ID);
    expect(item?.contractId).toBe(CONTRACT_ID); // scoped to the affected engagement
    expect(item?.status).toBe('MISSING'); // required-document, not yet satisfied
    // Sensitive system-side write is audited.
    expect(audits).toHaveLength(1);
    expect(audits[0]?.data.action).toBe('gulf.permitted_activity.noc.create');
  });

  it('does NOT fire the advisory when the contract has no activityIsicCodes (D-08 skip) [79-04]', async () => {
    const client = makeClient();
    const assignment = makeFreeZoneAssignment({ organizationId: ME_ORG.id });

    const result = await checkPermittedActivityScope(client, {
      organizationId: ME_ORG.id,
      contractorId: assignment.contractorId,
      contractId: CONTRACT_ID,
      permittedActivityIsicCodes: assignment.permittedActivityIsicCodes,
      contractActivityIsicCodes: [], // uncoded — skip entirely
    });

    expect(result).toEqual({ skipped: true });
    expect(items).toHaveLength(0); // no advisory, no NOC
    expect(audits).toHaveLength(0);
  });

  it('does NOT fire when the contract ISIC code overlaps the permitted set (in-scope) [79-04]', async () => {
    const client = makeClient();
    const assignment = makeFreeZoneAssignment({
      organizationId: ME_ORG.id,
      permittedActivityIsicCodes: ['6201', '6202'],
    });

    const result = await checkPermittedActivityScope(client, {
      organizationId: ME_ORG.id,
      contractorId: assignment.contractorId,
      contractId: CONTRACT_ID,
      permittedActivityIsicCodes: assignment.permittedActivityIsicCodes,
      contractActivityIsicCodes: ['9999', '6201'], // 6201 overlaps → in-scope
    });

    expect(result).toEqual({ mismatch: false });
    expect(items).toHaveLength(0);
    expect(audits).toHaveLength(0);
  });

  it('lets contract creation proceed regardless of the advisory (non-gating, D-07) [79-04]', async () => {
    const client = makeClient();
    // A mismatch must NOT throw — the caller (contract-create path, Plan 05) keeps going.
    await expect(
      checkPermittedActivityScope(client, {
        organizationId: ME_ORG.id,
        contractorId: 'cl_contractor_xxxxxxxxxxxxxx',
        contractId: CONTRACT_ID,
        permittedActivityIsicCodes: ['6201'],
        contractActivityIsicCodes: ['4520'],
      }),
    ).resolves.toEqual({ mismatch: true, nocItemCreated: true });
  });

  it('detects overlap by set-membership only, not fuzzy text (D-06) [79-04]', async () => {
    const client = makeClient();
    // '62' is a prefix of '6201' but NOT an exact code match → mismatch (no fuzzy/prefix logic).
    const result = await checkPermittedActivityScope(client, {
      organizationId: ME_ORG.id,
      contractorId: 'cl_contractor_yyyyyyyyyyyyyy',
      contractId: CONTRACT_ID,
      permittedActivityIsicCodes: ['6201'],
      contractActivityIsicCodes: ['62'],
    });

    expect(result).toEqual({ mismatch: true, nocItemCreated: true });
  });

  it('skips the check when the contractor has no permitted codes recorded (nothing to compare) [79-04]', async () => {
    const client = makeClient();
    const result = await checkPermittedActivityScope(client, {
      organizationId: ME_ORG.id,
      contractorId: 'cl_contractor_zzzzzzzzzzzzzz',
      contractId: CONTRACT_ID,
      permittedActivityIsicCodes: [], // contractor permitted-set uncoded → skip (symmetry with uncoded contract)
      contractActivityIsicCodes: ['4520'],
    });

    expect(result).toEqual({ skipped: true });
    expect(items).toHaveLength(0);
  });
});
