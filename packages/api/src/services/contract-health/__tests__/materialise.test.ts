import { beforeEach, describe, expect, it } from 'vitest';
import '@contractor-ops/compliance-policy'; // register all policy rules (incl. Phase 75 IP rules)
import type { Jurisdiction } from '@contractor-ops/validators';
import type { MaterialiseClient } from '../materialise.js';
import { JURISDICTION_TO_POLICY_RULE_ID, materialiseLikelyMissing } from '../materialise.js';

type Row = {
  id: string;
  organizationId: string;
  contractorId: string;
  contractId: string | null;
  name: string;
  documentType: string;
  severity: string | null;
  policyRuleId: string | null;
  expiryJurisdictionTz: string | null;
  expiresAt: Date | null;
  status: string;
};

let rows: Row[];
let nextId: number;

function makeClient(): { client: MaterialiseClient; createCalls: () => number } {
  let createCalls = 0;
  const client: MaterialiseClient = {
    contractorComplianceItem: {
      findFirst: (async (args: { where: Record<string, unknown> }) => {
        const where = args.where ?? {};
        const notStatus = (where.status as { not?: string } | undefined)?.not;
        const found = rows.find(
          r =>
            r.contractorId === where.contractorId &&
            r.policyRuleId === where.policyRuleId &&
            (!notStatus || r.status !== notStatus),
        );
        return found ? { id: found.id } : null;
      }) as never,
      create: (async (args: { data: Omit<Row, 'id'> }) => {
        createCalls++;
        const row: Row = { id: `item_${nextId++}`, ...args.data };
        rows.push(row);
        return { id: row.id };
      }) as never,
    },
  };
  return { client, createCalls: () => createCalls };
}

describe('materialiseLikelyMissing (Phase 75 D-07)', () => {
  beforeEach(() => {
    rows = [];
    nextId = 1;
  });

  it('creates exactly one open ContractorComplianceItem with severity WARNING', async () => {
    const { client, createCalls } = makeClient();
    await materialiseLikelyMissing(client, {
      organizationId: 'org_1',
      contractorId: 'ctr_1',
      contractId: 'ct_1',
      jurisdiction: 'UK',
    });
    expect(createCalls()).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.severity).toBe('WARNING');
  });

  it('uses the jurisdiction IP policyRuleId (DE = werkvertrag_ip, others = ip_assignment)', async () => {
    const cases: Array<[Jurisdiction, string]> = [
      ['UK', 'uk.ip_assignment@v1'],
      ['DE', 'de.werkvertrag_ip@v1'],
      ['PL', 'pl.ip_assignment@v1'],
      ['US', 'us.ip_assignment@v1'],
      ['KSA', 'ksa.ip_assignment@v1'],
      ['UAE', 'uae.ip_assignment@v1'],
    ];
    for (const [j, ruleId] of cases) {
      expect(JURISDICTION_TO_POLICY_RULE_ID[j]).toBe(ruleId);
    }
  });

  it('item.policyRuleId matches the resolved rule and documentType is IP_RATIFICATION', async () => {
    const { client } = makeClient();
    await materialiseLikelyMissing(client, {
      organizationId: 'org_1',
      contractorId: 'ctr_de',
      contractId: 'ct_de',
      jurisdiction: 'DE',
    });
    expect(rows[0]?.policyRuleId).toBe('de.werkvertrag_ip@v1');
    expect(rows[0]?.documentType).toBe('IP_RATIFICATION');
  });

  it('item.expiresAt is null (IP-assignment presence does not expire)', async () => {
    const { client } = makeClient();
    await materialiseLikelyMissing(client, {
      organizationId: 'org_1',
      contractorId: 'ctr_1',
      contractId: 'ct_1',
      jurisdiction: 'UK',
    });
    expect(rows[0]?.expiresAt).toBeNull();
  });

  it('item.expiryJurisdictionTz is set to the jurisdiction IANA TZ', async () => {
    const { client } = makeClient();
    await materialiseLikelyMissing(client, {
      organizationId: 'org_1',
      contractorId: 'ctr_1',
      contractId: 'ct_1',
      jurisdiction: 'DE',
    });
    expect(rows[0]?.expiryJurisdictionTz).toBe('Europe/Berlin');
  });

  it('is idempotent on (contractor, policyRuleId) — a re-run does not create a duplicate', async () => {
    const { client, createCalls } = makeClient();
    const args = {
      organizationId: 'org_1',
      contractorId: 'ctr_1',
      contractId: 'ct_1',
      jurisdiction: 'UK' as const,
    };
    const first = await materialiseLikelyMissing(client, args);
    const second = await materialiseLikelyMissing(client, args);
    expect(createCalls()).toBe(1);
    expect(second.contractorComplianceItemId).toBe(first.contractorComplianceItemId);
  });
});
