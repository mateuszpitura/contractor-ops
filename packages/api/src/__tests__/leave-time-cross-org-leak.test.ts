// Tenant-isolation proof for the leave + employee-time + ewidencja model
// families. Each model is tenant-owning (carries organizationId, deliberately
// absent from globalModels in tenant.ts), so every read/mutation MUST inherit
// withTenantScope: a cross-org access can never surface another org's row.
//
// Mirrors employee-cross-org-leak.test.ts — the REAL withTenantScope extension
// over a minimal fake base client whose query honours the injected `where`. It
// proves the scope mechanism, independent of the registration routers.

import { tenantStore, withTenantScope } from '@contractor-ops/db';
import { describe, expect, it } from 'vitest';

type Row = Record<string, unknown>;

interface HookParams {
  operation: string;
  model?: string;
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
}

const ORG_A_ID = 'org-a-00000000-0000-0000-0000-000000000001';
const ORG_B_ID = 'org-b-00000000-0000-0000-0000-000000000002';

interface ModelClient {
  findFirst: (args: unknown) => Promise<Row | null>;
  update: (args: unknown) => Promise<Row>;
}

/**
 * Builds a tenant-scoped client for a single delegate over a fake base whose
 * `query` filters seeded rows by the (post-injection) `where`. Returns the
 * client plus the list of `where` clauses the scope handed the query.
 */
function makeScopedClient(modelName: string, delegateKey: string, rows: Row[]) {
  const injectedWheres: Row[] = [];

  const runWhere = (args: unknown): Row[] => {
    const where = ((args ?? {}) as { where?: Row }).where ?? {};
    injectedWheres.push(where);
    return rows.filter(r => Object.entries(where).every(([k, v]) => r[k] === v));
  };

  const base = {
    $extends(ext: { query: { $allOperations: (p: HookParams) => Promise<unknown> } }) {
      const allOps = ext.query.$allOperations;
      const dispatch = (
        operation: string,
        args: unknown,
        query: (a: unknown) => Promise<unknown>,
      ) => allOps({ operation, model: modelName, args, query });
      return {
        [delegateKey]: {
          findFirst: (args: unknown) =>
            dispatch('findFirst', args, async a => runWhere(a)[0] ?? null),
          update: (args: unknown) =>
            dispatch('update', args, async a => {
              const match = runWhere(a)[0];
              if (!match) {
                throw Object.assign(new Error(`No ${modelName} found`), { code: 'P2025' });
              }
              return { ...match, ...((a as { data?: Row }).data ?? {}) };
            }),
        },
      };
    },
  };

  const client = withTenantScope(
    base as unknown as Parameters<typeof withTenantScope>[0],
  ) as unknown as Record<string, ModelClient>;
  return { delegate: client[delegateKey], injectedWheres };
}

const FAMILIES: ReadonlyArray<{
  model: string;
  key: string;
  rowA: Row;
  rowB: Row;
  mutation: Row;
  appendOnly?: boolean;
}> = [
  {
    model: 'LeaveLedgerEntry',
    key: 'leaveLedgerEntry',
    rowA: { id: 'ledger-a', organizationId: ORG_A_ID, workerId: 'w-a', minutes: -480 },
    rowB: { id: 'ledger-b', organizationId: ORG_B_ID, workerId: 'w-b', minutes: -480 },
    mutation: { reason: 'correction' },
    // LeaveLedgerEntry is in APPEND_ONLY_MODELS — update is blocked by the
    // append-only guard (stronger than the cross-org filter), so the mutation
    // rejects regardless of org rather than surfacing P2025.
    appendOnly: true,
  },
  {
    model: 'LeaveRequest',
    key: 'leaveRequest',
    rowA: { id: 'req-a', organizationId: ORG_A_ID, workerId: 'w-a', status: 'PENDING' },
    rowB: { id: 'req-b', organizationId: ORG_B_ID, workerId: 'w-b', status: 'PENDING' },
    mutation: { status: 'CANCELLED' },
  },
  {
    model: 'EmployeeTimeRecord',
    key: 'employeeTimeRecord',
    rowA: { id: 'etr-a', organizationId: ORG_A_ID, workerId: 'w-a', workedMinutes: 480 },
    rowB: { id: 'etr-b', organizationId: ORG_B_ID, workerId: 'w-b', workedMinutes: 480 },
    mutation: { workedMinutes: 0 },
  },
  {
    model: 'EwidencjaSnapshot',
    key: 'ewidencjaSnapshot',
    rowA: { id: 'ewi-a', organizationId: ORG_A_ID, workerId: 'w-a', version: 1 },
    rowB: { id: 'ewi-b', organizationId: ORG_B_ID, workerId: 'w-b', version: 1 },
    mutation: { status: 'SUPERSEDED' },
  },
];

describe('leave + time + ewidencja cross-org isolation', () => {
  for (const family of FAMILIES) {
    describe(family.model, () => {
      it('does not return an org B row to an org A caller (injects the org filter)', async () => {
        const { delegate, injectedWheres } = makeScopedClient(family.model, family.key, [
          family.rowA,
          family.rowB,
        ]);

        const leaked = await tenantStore.run({ organizationId: ORG_A_ID, region: 'EU' }, () =>
          delegate.findFirst({ where: { id: family.rowB.id } }),
        );

        expect(leaked).toBeNull();
        expect(injectedWheres[0]).toMatchObject({ id: family.rowB.id, organizationId: ORG_A_ID });
      });

      it('returns the caller org own row (positive control)', async () => {
        const { delegate } = makeScopedClient(family.model, family.key, [family.rowA, family.rowB]);

        const own = await tenantStore.run({ organizationId: ORG_A_ID, region: 'EU' }, () =>
          delegate.findFirst({ where: { id: family.rowA.id } }),
        );

        expect(own).toMatchObject({ id: family.rowA.id, organizationId: ORG_A_ID });
      });

      it('rejects a cross-org mutation (P2025, or the append-only guard for the ledger)', async () => {
        const { delegate } = makeScopedClient(family.model, family.key, [family.rowA, family.rowB]);

        const attempt = tenantStore.run({ organizationId: ORG_A_ID, region: 'EU' }, () =>
          delegate.update({ where: { id: family.rowB.id }, data: family.mutation }),
        );

        if (family.appendOnly) {
          await expect(attempt).rejects.toThrow();
        } else {
          await expect(attempt).rejects.toMatchObject({ code: 'P2025' });
        }
      });

      it('throws when no tenant context is set (fail-closed)', async () => {
        const { delegate } = makeScopedClient(family.model, family.key, [family.rowA, family.rowB]);

        await expect(delegate.findFirst({ where: { id: family.rowA.id } })).rejects.toThrow(
          'Tenant context not initialized',
        );
      });
    });
  }
});
