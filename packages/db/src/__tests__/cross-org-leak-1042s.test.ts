// Cross-org isolation for the new US tenant-owning models (Form1042S,
// Form1099KTrackerState). Both carry organizationId and are deliberately absent
// from `globalModels`, so the tenant-scoping middleware injects the caller's
// organizationId into every read — an org-B client can never see org-A rows.
//
// Mirrors the mock-based approach of tenant.test.ts (no live Postgres): a tiny
// in-memory store filters by the injected `where.organizationId`, so a leak would
// surface as an org-B query returning org-A rows.

import { describe, expect, it } from 'vitest';
import type { PrismaExtensible } from '../tenant.js';
import { tenantStore, withTenantScope } from '../tenant.js';

const ORG_A = 'org_a';
const ORG_B = 'org_b';

type Row = { id: string; organizationId: string };

type AllOps = (params: {
  operation: string;
  model?: string;
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
}) => Promise<unknown>;

function createMockClient(seed: { form1042S: Row[]; form1099KTrackerState: Row[] }) {
  const stores: Record<string, Row[]> = {
    Form1042S: [...seed.form1042S],
    Form1099KTrackerState: [...seed.form1099KTrackerState],
  };

  // The middleware injects `where.organizationId`; the fake store honours it, so
  // the injected tenant scope is what decides which rows come back.
  const runFiltered = (model: string) => async (args: unknown) => {
    const where = ((args as { where?: { organizationId?: string } })?.where ?? {}) as {
      organizationId?: string;
    };
    return stores[model].filter(row => row.organizationId === where.organizationId);
  };

  const base = {
    $extends: (ext: { query: { $allOperations: AllOps } }) => {
      const allOps = ext.query.$allOperations;
      const make = (model: string) => ({
        findMany: (args: unknown) =>
          allOps({ operation: 'findMany', model, args, query: runFiltered(model) }),
        findFirst: (args: unknown) =>
          allOps({ operation: 'findFirst', model, args, query: runFiltered(model) }),
      });
      return {
        form1042S: make('Form1042S'),
        form1099KTrackerState: make('Form1099KTrackerState'),
      };
    },
  };

  return withTenantScope(base as PrismaExtensible);
}

function seededClient() {
  return createMockClient({
    form1042S: [
      { id: 'f1042s_a1', organizationId: ORG_A },
      { id: 'f1042s_a2', organizationId: ORG_A },
    ],
    form1099KTrackerState: [{ id: 'trk_a1', organizationId: ORG_A }],
  });
}

describe('cross-org isolation — Form1042S / Form1099KTrackerState', () => {
  it('does not leak org-A Form1042S rows to an org-B client', async () => {
    const client = seededClient();
    const rows = await tenantStore.run({ organizationId: ORG_B, region: 'US' }, () =>
      client.form1042S.findMany({ where: {} }),
    );
    expect(rows).toHaveLength(0);
  });

  it('returns an org its own Form1042S rows (positive control)', async () => {
    const client = seededClient();
    const rows = (await tenantStore.run({ organizationId: ORG_A, region: 'US' }, () =>
      client.form1042S.findMany({ where: {} }),
    )) as Row[];
    expect(rows).toHaveLength(2);
    expect(rows.every(r => r.organizationId === ORG_A)).toBe(true);
  });

  it('does not leak org-A Form1099KTrackerState rows to an org-B client', async () => {
    const client = seededClient();
    const many = await tenantStore.run({ organizationId: ORG_B, region: 'US' }, () =>
      client.form1099KTrackerState.findMany({ where: {} }),
    );
    const first = await tenantStore.run({ organizationId: ORG_B, region: 'US' }, () =>
      client.form1099KTrackerState.findFirst({ where: {} }),
    );
    expect(many).toHaveLength(0);
    expect(first).toHaveLength(0);
  });

  it('returns an org its own Form1099KTrackerState rows (positive control)', async () => {
    const client = seededClient();
    const rows = (await tenantStore.run({ organizationId: ORG_A, region: 'US' }, () =>
      client.form1099KTrackerState.findMany({ where: {} }),
    )) as Row[];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.organizationId).toBe(ORG_A);
  });

  it('refuses tenant-owning reads without a tenant context', async () => {
    const client = seededClient();
    await expect(client.form1042S.findMany({ where: {} })).rejects.toThrow(
      'Tenant context not initialized',
    );
  });
});
