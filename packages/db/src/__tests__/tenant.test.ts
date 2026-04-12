import { describe, expect, it, vi } from 'vitest';
import type { PrismaExtensible } from '../tenant.js';
import { tenantStore, withTenantScope } from '../tenant.js';

describe('withTenantScope', () => {
  function createMockClient() {
    const innerQuery = vi.fn(async (args: unknown) => args);
    const base = {
      $extends: (ext: { query: { $allOperations: (p: unknown) => Promise<unknown> } }) => {
        const $allOps = ext.query.$allOperations;
        return {
          contractor: {
            findMany: (args: unknown) =>
              $allOps({
                operation: 'findMany',
                model: 'Contractor',
                args,
                query: innerQuery,
              }),
          },
          user: {
            findMany: (args: unknown) =>
              $allOps({
                operation: 'findMany',
                model: 'User',
                args,
                query: innerQuery,
              }),
          },
          organization: {
            findMany: (args: unknown) =>
              $allOps({
                operation: 'findMany',
                model: 'Organization',
                args,
                query: innerQuery,
              }),
          },
          invoice: {
            create: (args: unknown) =>
              $allOps({
                operation: 'create',
                model: 'Invoice',
                args,
                query: innerQuery,
              }),
            createMany: (args: unknown) =>
              $allOps({
                operation: 'createMany',
                model: 'Invoice',
                args,
                query: innerQuery,
              }),
            update: (args: unknown) =>
              $allOps({
                operation: 'update',
                model: 'Invoice',
                args,
                query: innerQuery,
              }),
            deleteMany: (args: unknown) =>
              $allOps({
                operation: 'deleteMany',
                model: 'Invoice',
                args,
                query: innerQuery,
              }),
            upsert: (args: unknown) =>
              $allOps({
                operation: 'upsert',
                model: 'Invoice',
                args,
                query: innerQuery,
              }),
            aggregate: (args: unknown) =>
              $allOps({
                operation: 'aggregate',
                model: 'Invoice',
                args,
                query: innerQuery,
              }),
            groupBy: (args: unknown) =>
              $allOps({
                operation: 'groupBy',
                model: 'Invoice',
                args,
                query: innerQuery,
              }),
            createManyAndReturn: (args: unknown) =>
              $allOps({
                operation: 'createManyAndReturn',
                model: 'Invoice',
                args,
                query: innerQuery,
              }),
          },
        };
      },
    };
    const client = withTenantScope(base as PrismaExtensible);
    return { client, innerQuery };
  }

  it('throws when tenant context is missing', async () => {
    const { client } = createMockClient();
    await expect(client.contractor.findMany({ where: { status: 'ACTIVE' } })).rejects.toThrow(
      'Tenant context not initialized',
    );
  });

  it('injects organizationId into findMany for tenant models', async () => {
    const { client, innerQuery } = createMockClient();
    await tenantStore.run({ organizationId: 'org_1' }, async () => {
      await client.contractor.findMany({ where: { status: 'ACTIVE' } });
    });
    expect(innerQuery).toHaveBeenCalledWith({
      where: { status: 'ACTIVE', organizationId: 'org_1' },
    });
  });

  it('does not inject organizationId for global models', async () => {
    const { client, innerQuery } = createMockClient();
    await tenantStore.run({ organizationId: 'org_1' }, async () => {
      await client.user.findMany({ where: { email: 'a@b.com' } });
    });
    expect(innerQuery).toHaveBeenCalledWith({
      where: { email: 'a@b.com' },
    });
  });

  it('injects organizationId into create data', async () => {
    const { client, innerQuery } = createMockClient();
    await tenantStore.run({ organizationId: 'org_1' }, async () => {
      await client.invoice.create({
        data: { amount: 100, currency: 'PLN' },
      });
    });
    expect(innerQuery).toHaveBeenCalledWith({
      data: { amount: 100, currency: 'PLN', organizationId: 'org_1' },
    });
  });

  it('injects organizationId into update where', async () => {
    const { client, innerQuery } = createMockClient();
    await tenantStore.run({ organizationId: 'org_1' }, async () => {
      await client.invoice.update({
        where: { id: 'inv_1' },
        data: { status: 'PAID' },
      });
    });
    expect(innerQuery).toHaveBeenCalledWith({
      where: { id: 'inv_1', organizationId: 'org_1' },
      data: { status: 'PAID' },
    });
  });

  it('injects organizationId into createMany data array', async () => {
    const { client, innerQuery } = createMockClient();
    await tenantStore.run({ organizationId: 'org_1' }, async () => {
      await client.invoice.createMany({
        data: [
          { amount: 100, currency: 'PLN' },
          { amount: 200, currency: 'EUR' },
        ],
      });
    });
    expect(innerQuery).toHaveBeenCalledWith({
      data: [
        { amount: 100, currency: 'PLN', organizationId: 'org_1' },
        { amount: 200, currency: 'EUR', organizationId: 'org_1' },
      ],
    });
  });

  it('injects organizationId into deleteMany where', async () => {
    const { client, innerQuery } = createMockClient();
    await tenantStore.run({ organizationId: 'org_1' }, async () => {
      await client.invoice.deleteMany({ where: { status: 'DRAFT' } });
    });
    expect(innerQuery).toHaveBeenCalledWith({
      where: { status: 'DRAFT', organizationId: 'org_1' },
    });
  });

  it('injects organizationId into upsert where, create, and update data', async () => {
    const { client, innerQuery } = createMockClient();
    await tenantStore.run({ organizationId: 'org_1' }, async () => {
      await client.invoice.upsert({
        where: { id: 'inv_1' },
        create: { amount: 100, currency: 'PLN' },
        update: { amount: 200 },
      });
    });
    expect(innerQuery).toHaveBeenCalledWith({
      where: { id: 'inv_1', organizationId: 'org_1' },
      create: { amount: 100, currency: 'PLN', organizationId: 'org_1' },
      update: { amount: 200, organizationId: 'org_1' },
    });
  });

  it('injects organizationId into aggregate where', async () => {
    const { client, innerQuery } = createMockClient();
    await tenantStore.run({ organizationId: 'org_1' }, async () => {
      await client.invoice.aggregate({ where: { status: 'PAID' } });
    });
    expect(innerQuery).toHaveBeenCalledWith({
      where: { status: 'PAID', organizationId: 'org_1' },
    });
  });

  it('injects organizationId into groupBy where', async () => {
    const { client, innerQuery } = createMockClient();
    await tenantStore.run({ organizationId: 'org_1' }, async () => {
      await client.invoice.groupBy({ where: { status: 'SENT' } });
    });
    expect(innerQuery).toHaveBeenCalledWith({
      where: { status: 'SENT', organizationId: 'org_1' },
    });
  });

  it('injects organizationId into createManyAndReturn data array', async () => {
    const { client, innerQuery } = createMockClient();
    await tenantStore.run({ organizationId: 'org_1' }, async () => {
      await client.invoice.createManyAndReturn({
        data: [
          { amount: 100, currency: 'PLN' },
          { amount: 200, currency: 'EUR' },
        ],
      });
    });
    expect(innerQuery).toHaveBeenCalledWith({
      data: [
        { amount: 100, currency: 'PLN', organizationId: 'org_1' },
        { amount: 200, currency: 'EUR', organizationId: 'org_1' },
      ],
    });
  });

  it('does not inject organizationId for Organization model (global model)', async () => {
    const { client, innerQuery } = createMockClient();
    await tenantStore.run({ organizationId: 'org_1' }, async () => {
      await client.organization.findMany({ where: { id: 'org_1' } });
    });
    expect(innerQuery).toHaveBeenCalledWith({
      where: { id: 'org_1' },
    });
  });
});
