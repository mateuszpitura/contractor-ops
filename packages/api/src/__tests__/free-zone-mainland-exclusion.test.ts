// Recording a MAINLAND `FreeZoneAssignment` must write NO free-zone BLOCKING
// compliance item, so a Mainland (DED-licensed) contractor is NOT payment-blocked
// on license expiry. Mainland is a recordable enum value but arms no gate.
//
// A false-positive here blocks a legitimately-payable contractor. The narrowing
// lives in the FreeZoneAssignment service write (zone !== 'MAINLAND'), NOT in the
// policy `appliesIf` (EngagementContext has no zone field).

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
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

import type { FreeZoneComplianceClient } from '../services/free-zone-compliance';
import {
  FREE_ZONE_POLICY_RULE_ID,
  writeFreeZoneComplianceItem,
} from '../services/free-zone-compliance';

const ME_ORG = makeMeOrg();

interface ItemRow {
  id: string;
  organizationId: string;
  contractorId: string;
  policyRuleId: string | null;
  severity: string | null;
  status: string;
  expiresAt: Date | null;
}

let items: ItemRow[] = [];
let audits: Array<{ data: Record<string, unknown> }> = [];
let nextId = 1;

/** In-memory structural client mirroring the supersession test's makeClient. */
function makeClient(): FreeZoneComplianceClient {
  return {
    contractorComplianceItem: {
      findFirst: (async (args: { where: Record<string, unknown> }) => {
        const where = args.where ?? {};
        return (
          items.find(r => {
            if (where.organizationId && r.organizationId !== where.organizationId) return false;
            if (where.contractorId && r.contractorId !== where.contractorId) return false;
            if (where.policyRuleId && r.policyRuleId !== where.policyRuleId) return false;
            const status = where.status as { not?: string } | undefined;
            if (status?.not && r.status === status.not) return false;
            return true;
          }) ?? null
        );
      }) as never,
      create: (async (args: { data: Partial<ItemRow> }) => {
        const row: ItemRow = {
          id: `cl_item_${nextId++}`,
          organizationId: args.data.organizationId ?? '',
          contractorId: args.data.contractorId ?? '',
          policyRuleId: args.data.policyRuleId ?? null,
          severity: args.data.severity ?? null,
          status: args.data.status ?? 'MISSING',
          expiresAt: args.data.expiresAt ?? null,
        };
        items.push(row);
        return row;
      }) as never,
      update: (async (args: { where: { id: string }; data: Partial<ItemRow> }) => {
        const row = items.find(r => r.id === args.where.id);
        if (row) Object.assign(row, args.data);
        return row;
      }) as never,
    },
    contractorComplianceReminderState: {
      findUnique: (async () => null) as never,
      upsert: (async () => ({})) as never,
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

describe('C2 (GULF-01/02, D-04) Mainland exclusion — no free-zone item, no payment-block', () => {
  it('writes NO ContractorComplianceItem when the FreeZoneAssignment zone is MAINLAND [79-03]', async () => {
    const client = makeClient();
    const assignment = makeFreeZoneAssignment({
      organizationId: ME_ORG.id,
      zone: 'MAINLAND',
      licenseExpiresAt: new Date('2020-01-01T00:00:00Z'), // long past — still no item
    });

    const result = await writeFreeZoneComplianceItem(client, {
      assignment,
      now: new Date('2026-06-03T00:00:00Z'),
    });

    expect(result).toEqual({ written: false, itemId: null, status: null, reason: 'MAINLAND' });
    expect(items).toHaveLength(0);
    // No audit log either — nothing was written.
    expect(audits).toHaveLength(0);
  });

  it('does NOT payment-block a Mainland contractor even after the license expiry date [79-03]', async () => {
    const client = makeClient();
    await writeFreeZoneComplianceItem(client, {
      assignment: makeFreeZoneAssignment({
        organizationId: ME_ORG.id,
        zone: 'MAINLAND',
        licenseExpiresAt: new Date('2020-01-01T00:00:00Z'),
      }),
      now: new Date('2026-06-03T00:00:00Z'),
    });

    // No BLOCKING+EXPIRED free-zone row exists → the gate has nothing to block on.
    const blocking = items.filter(r => r.severity === 'BLOCKING' && r.status === 'EXPIRED');
    expect(blocking).toHaveLength(0);
  });

  it('still writes a BLOCKING item for a non-Mainland free-zone (e.g. DMCC) assignment [79-03]', async () => {
    const client = makeClient();
    const result = await writeFreeZoneComplianceItem(client, {
      assignment: makeFreeZoneAssignment({
        organizationId: ME_ORG.id,
        zone: 'DMCC',
        licenseExpiresAt: new Date('2020-01-01T00:00:00Z'), // expired
      }),
      now: new Date('2026-06-03T00:00:00Z'),
    });

    expect(result.written).toBe(true);
    expect(result.status).toBe('EXPIRED');
    expect(items).toHaveLength(1);
    expect(items[0]?.severity).toBe('BLOCKING');
    expect(items[0]?.policyRuleId).toBe(FREE_ZONE_POLICY_RULE_ID);
    expect(items[0]?.status).toBe('EXPIRED');
    // Sensitive mutation is audited.
    expect(audits.some(a => a.data.action === 'gulf.free_zone.compliance_item.create')).toBe(true);
  });

  it('writes a PENDING (not EXPIRED) item for a future-dated free-zone license [79-03]', async () => {
    const client = makeClient();
    const result = await writeFreeZoneComplianceItem(client, {
      assignment: makeFreeZoneAssignment({
        organizationId: ME_ORG.id,
        zone: 'DMCC',
        licenseExpiresAt: new Date('2027-12-31T00:00:00Z'), // future
      }),
      now: new Date('2026-06-03T00:00:00Z'),
    });

    expect(result.written).toBe(true);
    expect(result.status).toBe('PENDING');
    expect(items[0]?.status).toBe('PENDING');
  });
});
