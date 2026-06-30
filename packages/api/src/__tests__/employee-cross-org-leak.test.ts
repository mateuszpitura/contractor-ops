// Tenant-isolation proof for the EmployeeProfile personnel record.
//
// EmployeeProfile is tenant-owning (carries organizationId, deliberately absent
// from globalModels in tenant.ts), so it MUST inherit the withTenantScope
// predicate: every read/mutation is auto-scoped to the caller's organizationId
// and a cross-org access can never surface another org's personnel row.
//
// This drives the REAL withTenantScope extension (imported from @contractor-ops/db)
// over a minimal fake base client whose underlying query honours the injected
// `where`, mirroring the db package's own tenant.test.ts idiom. It proves the
// invariant without the registration router (which lands in a later plan): the
// scope mechanism itself is what guarantees isolation, and EmployeeProfile is
// wired into it exactly like every other tenant model.

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

const profileA: Row = {
  id: 'emp-profile-a-001',
  organizationId: ORG_A_ID,
  workerId: 'worker-a-001',
  countryCode: 'PL',
  employmentStatus: 'ACTIVE',
};
const profileB: Row = {
  id: 'emp-profile-b-001',
  organizationId: ORG_B_ID,
  workerId: 'worker-b-001',
  countryCode: 'SA',
  employmentStatus: 'ACTIVE',
};

interface EmployeeProfileClient {
  employeeProfile: {
    findFirst: (args: unknown) => Promise<Row | null>;
    update: (args: unknown) => Promise<Row>;
  };
}

/**
 * Builds a tenant-scoped client over a fake base whose `query` filters the
 * seeded rows by the (post-injection) `where`. Returns the client plus the
 * list of `where` clauses the scope handed to the underlying query, so a test
 * can assert organizationId was injected.
 */
function makeScopedClient(rows: Row[]) {
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
      ) => allOps({ operation, model: 'EmployeeProfile', args, query });
      return {
        employeeProfile: {
          findFirst: (args: unknown) =>
            dispatch('findFirst', args, async a => runWhere(a)[0] ?? null),
          update: (args: unknown) =>
            dispatch('update', args, async a => {
              const match = runWhere(a)[0];
              // Prisma's update throws P2025 when the where resolves to no row;
              // routers translate that to NOT_FOUND. A cross-org where (scoped to
              // the caller's org) can never match the foreign row.
              if (!match) {
                throw Object.assign(new Error('No EmployeeProfile found'), { code: 'P2025' });
              }
              return { ...match, ...((a as { data?: Row }).data ?? {}) };
            }),
        },
      };
    },
  };

  const client = withTenantScope(
    base as unknown as Parameters<typeof withTenantScope>[0],
  ) as unknown as EmployeeProfileClient;
  return { client, injectedWheres };
}

describe('EmployeeProfile cross-org isolation', () => {
  it('does not return org B EmployeeProfile rows to an org A caller', async () => {
    const { client, injectedWheres } = makeScopedClient([profileA, profileB]);

    const leaked = await tenantStore.run({ organizationId: ORG_A_ID, region: 'EU' }, () =>
      client.employeeProfile.findFirst({ where: { id: profileB.id } }),
    );

    expect(leaked).toBeNull();
    // The scope injected the caller's org into the where, so the foreign row
    // (organizationId = org B) is filtered out at the query boundary.
    expect(injectedWheres[0]).toMatchObject({ id: profileB.id, organizationId: ORG_A_ID });
  });

  it('returns the caller org own EmployeeProfile (positive control)', async () => {
    const { client } = makeScopedClient([profileA, profileB]);

    const own = await tenantStore.run({ organizationId: ORG_A_ID, region: 'EU' }, () =>
      client.employeeProfile.findFirst({ where: { id: profileA.id } }),
    );

    expect(own).toMatchObject({ id: profileA.id, organizationId: ORG_A_ID });
  });

  it('rejects a cross-org EmployeeProfile mutation with NOT_FOUND', async () => {
    const { client, injectedWheres } = makeScopedClient([profileA, profileB]);

    await expect(
      tenantStore.run({ organizationId: ORG_A_ID, region: 'EU' }, () =>
        client.employeeProfile.update({
          where: { id: profileB.id },
          data: { employmentStatus: 'TERMINATED' },
        }),
      ),
    ).rejects.toMatchObject({ code: 'P2025' });

    expect(injectedWheres[0]).toMatchObject({ id: profileB.id, organizationId: ORG_A_ID });
  });

  it('throws when no tenant context is set (fail-closed)', async () => {
    const { client } = makeScopedClient([profileA, profileB]);

    await expect(client.employeeProfile.findFirst({ where: { id: profileA.id } })).rejects.toThrow(
      'Tenant context not initialized',
    );
  });
});
