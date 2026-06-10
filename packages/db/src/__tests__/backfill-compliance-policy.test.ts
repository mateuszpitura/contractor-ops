// backfillComplianceItems pure-function tests.
//
// Tests the in-memory backfill computation without touching a real DB. The CLI
// entry (main()) wraps prisma operations around this same pure function.

import { describe, expect, it } from 'vitest';
import '@contractor-ops/compliance-policy';
import { backfillComplianceItems } from '../../scripts/backfill-compliance-policy.js';

describe('backfill-compliance-policy.ts — Phase 71 D-08 step 2 (idempotent backfill of new columns)', () => {
  it('populates policyRuleId on existing ContractorComplianceItem rows from latest completed assessment', () => {
    const result = backfillComplianceItems({
      contractorContexts: [
        {
          contractorId: 'c1',
          jurisdiction: 'UK',
          outcomeKind: 'IR35-INSIDE',
          contractorNationality: 'GB',
          sector: null,
          requiresRegulatedEquipment: false,
        },
      ],
      rows: [
        {
          id: 'r1',
          contractorId: 'c1',
          documentType: 'UK_RIGHT_TO_WORK_SHARE_CODE',
          status: 'MISSING',
          policyRuleId: null,
        },
        {
          id: 'r2',
          contractorId: 'c1',
          documentType: 'UK_UTR',
          status: 'SATISFIED',
          policyRuleId: null,
        },
      ],
    });
    expect(result.updates).toHaveLength(2);
    expect(result.updates).toContainEqual(
      expect.objectContaining({
        rowId: 'r1',
        policyRuleId: 'uk.right_to_work@v1',
      }),
    );
  });

  it('populates severity from policy rule registry', () => {
    const result = backfillComplianceItems({
      contractorContexts: [
        {
          contractorId: 'c1',
          jurisdiction: 'UK',
          outcomeKind: 'IR35-INSIDE',
          contractorNationality: 'GB',
          sector: null,
          requiresRegulatedEquipment: false,
        },
      ],
      rows: [
        {
          id: 'r1',
          contractorId: 'c1',
          documentType: 'UK_RIGHT_TO_WORK_SHARE_CODE',
          status: 'MISSING',
          policyRuleId: null,
        },
        {
          id: 'r2',
          contractorId: 'c1',
          documentType: 'UK_UTR',
          status: 'MISSING',
          policyRuleId: null,
        },
      ],
    });
    const rtw = result.updates.find(u => u.rowId === 'r1');
    const utr = result.updates.find(u => u.rowId === 'r2');
    expect(rtw?.severity).toBe('BLOCKING');
    expect(utr?.severity).toBe('WARNING');
  });

  it('populates expiryJurisdictionTz from policy rule registry', () => {
    const result = backfillComplianceItems({
      contractorContexts: [
        {
          contractorId: 'c1',
          jurisdiction: 'KSA',
          outcomeKind: 'CROSS_BORDER',
          contractorNationality: 'IN',
          sector: null,
          requiresRegulatedEquipment: false,
        },
      ],
      rows: [
        {
          id: 'r1',
          contractorId: 'c1',
          documentType: 'KSA_IQAMA',
          status: 'MISSING',
          policyRuleId: null,
        },
      ],
    });
    expect(result.updates[0]?.expiryJurisdictionTz).toBe('Asia/Riyadh');
  });

  it('idempotent: WHERE policyRuleId IS NULL — second run reports 0 updates', () => {
    const result = backfillComplianceItems({
      contractorContexts: [
        {
          contractorId: 'c1',
          jurisdiction: 'UK',
          outcomeKind: 'IR35-INSIDE',
          contractorNationality: null,
          sector: null,
          requiresRegulatedEquipment: false,
        },
      ],
      rows: [
        {
          id: 'r1',
          contractorId: 'c1',
          documentType: 'UK_UTR',
          status: 'MISSING',
          policyRuleId: 'uk.utr@v1',
        },
      ],
    });
    expect(result.updates).toHaveLength(0);
  });

  it('skips contractors without a completed assessment; logs skip count', () => {
    const result = backfillComplianceItems({
      contractorContexts: [],
      rows: [
        {
          id: 'r1',
          contractorId: 'unknown_c',
          documentType: 'UK_UTR',
          status: 'MISSING',
          policyRuleId: null,
        },
      ],
    });
    expect(result.updates).toHaveLength(0);
    expect(result.skippedContractorsNoContext).toBe(1);
  });

  it('skips rows whose documentType does not match any rule for the contractor outcome', () => {
    const result = backfillComplianceItems({
      contractorContexts: [
        {
          contractorId: 'c1',
          jurisdiction: 'UK',
          outcomeKind: 'IR35-INSIDE',
          contractorNationality: null,
          sector: null,
          requiresRegulatedEquipment: false,
        },
      ],
      rows: [
        {
          id: 'r1',
          contractorId: 'c1',
          documentType: 'CUSTOM_ORG_DOC',
          status: 'MISSING',
          policyRuleId: null,
        },
      ],
    });
    expect(result.updates).toHaveLength(0);
    expect(result.skippedRowsNoMatchingRule).toBe(1);
  });

  it('skips WAIVED rows (preserves audit history)', () => {
    const result = backfillComplianceItems({
      contractorContexts: [
        {
          contractorId: 'c1',
          jurisdiction: 'UK',
          outcomeKind: 'IR35-INSIDE',
          contractorNationality: null,
          sector: null,
          requiresRegulatedEquipment: false,
        },
      ],
      rows: [
        {
          id: 'r1',
          contractorId: 'c1',
          documentType: 'UK_UTR',
          status: 'WAIVED',
          policyRuleId: null,
        },
      ],
    });
    expect(result.updates).toHaveLength(0);
  });

  it('handles DE construction-conditional rule (sector = null → §48b NOT emitted)', () => {
    // Conservative default: sector=null means de.eight_b_estg@v1 does NOT apply.
    const result = backfillComplianceItems({
      contractorContexts: [
        {
          contractorId: 'c1',
          jurisdiction: 'DE',
          outcomeKind: 'ABHANGIG',
          contractorNationality: 'DE',
          sector: null,
          requiresRegulatedEquipment: false,
        },
      ],
      rows: [
        {
          id: 'r1',
          contractorId: 'c1',
          documentType: 'DE_FREISTELLUNGSBESCHEINIGUNG',
          status: 'MISSING',
          policyRuleId: null,
        },
        {
          id: 'r2',
          contractorId: 'c1',
          documentType: 'DE_A1_BESCHEINIGUNG',
          status: 'MISSING',
          policyRuleId: null,
        },
      ],
    });
    // r1 (de.eight_b_estg) NOT backfilled — appliesIf returned false (sector !== 'construction')
    // r2 (de.a1) IS backfilled — appliesIf returns true unconditionally
    expect(result.updates).toHaveLength(1);
    expect(result.updates[0]?.rowId).toBe('r2');
    expect(result.updates[0]?.policyRuleId).toBe('de.a1@v1');
    expect(result.skippedRowsNoMatchingRule).toBe(1);
  });
});
