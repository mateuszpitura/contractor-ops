// Phase 59 · Plan 59-01 Task 2 — APPEND_ONLY_MODELS guard for ClassificationDocument (D-06).
//
// The tenant-scoped Prisma client extension blocks update / updateMany / upsert
// on ClassificationDocument at runtime. This preserves byte-exact audit trails
// required for IR35 SDS (CLASS-03) and DRV defense bundles (CLASS-06).
//
// The test suite uses the same lightweight $extends mock shape as tenant.test.ts
// (no real database connection required).

import { describe, expect, it, vi } from 'vitest';

import type { PrismaExtensible } from '../tenant.js';
import { tenantStore, withTenantScope } from '../tenant.js';

type AllOps = (params: {
  operation: string;
  model?: string;
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
}) => Promise<unknown>;

function createMockClient() {
  const innerQuery = vi.fn(async (args: unknown) => args);
  const base = {
    $extends: (ext: { query: { $allOperations: AllOps } }) => {
      const $allOps = ext.query.$allOperations;
      const make = (model: string) => ({
        create: (args: unknown) =>
          $allOps({ operation: 'create', model, args, query: innerQuery }),
        findMany: (args: unknown) =>
          $allOps({ operation: 'findMany', model, args, query: innerQuery }),
        findUnique: (args: unknown) =>
          $allOps({ operation: 'findUnique', model, args, query: innerQuery }),
        update: (args: unknown) =>
          $allOps({ operation: 'update', model, args, query: innerQuery }),
        updateMany: (args: unknown) =>
          $allOps({ operation: 'updateMany', model, args, query: innerQuery }),
        upsert: (args: unknown) =>
          $allOps({ operation: 'upsert', model, args, query: innerQuery }),
        delete: (args: unknown) =>
          $allOps({ operation: 'delete', model, args, query: innerQuery }),
      });
      return {
        classificationDocument: make('ClassificationDocument'),
        contractor: make('Contractor'),
      };
    },
  };
  const client = withTenantScope(base as PrismaExtensible);
  return { client, innerQuery };
}

describe('Append-only models (Phase 59 D-06)', () => {
  const APPEND_ONLY_ERROR =
    'ClassificationDocument is append-only; mutations after insert are forbidden (Phase 59 D-06).';

  it('allows create on ClassificationDocument', async () => {
    const { client, innerQuery } = createMockClient();
    await tenantStore.run({ organizationId: 'org_1', region: 'EU' }, async () => {
      await client.classificationDocument.create({
        data: {
          classificationAssessmentId: 'ca_1',
          kind: 'SDS',
          pdfKey: 'classification-documents/org_1/ca_1/sds-ir35-v2-abc123.pdf',
          sha256Hash: 'a'.repeat(64),
          byteSize: 1024,
          rendererVersion: 'react-pdf@4.3.1',
          ruleSetVersion: 'ir35-v2',
          generatedByUserId: 'user_1',
        },
      });
    });
    expect(innerQuery).toHaveBeenCalledOnce();
  });

  it('blocks update on ClassificationDocument with exact error message', async () => {
    const { client } = createMockClient();
    await tenantStore.run({ organizationId: 'org_1', region: 'EU' }, async () => {
      await expect(
        client.classificationDocument.update({
          where: { id: 'cd_1' },
          data: { pdfKey: 'tampered' },
        }),
      ).rejects.toThrow(APPEND_ONLY_ERROR);
    });
  });

  it('blocks updateMany on ClassificationDocument', async () => {
    const { client } = createMockClient();
    await tenantStore.run({ organizationId: 'org_1', region: 'EU' }, async () => {
      await expect(
        client.classificationDocument.updateMany({
          where: { kind: 'SDS' },
          data: { pdfKey: 'tampered' },
        }),
      ).rejects.toThrow(APPEND_ONLY_ERROR);
    });
  });

  it('blocks upsert on ClassificationDocument', async () => {
    const { client } = createMockClient();
    await tenantStore.run({ organizationId: 'org_1', region: 'EU' }, async () => {
      await expect(
        client.classificationDocument.upsert({
          where: { id: 'cd_1' },
          create: {
            classificationAssessmentId: 'ca_1',
            kind: 'SDS',
            pdfKey: 'classification-documents/org_1/ca_1/sds-ir35-v2-abc123.pdf',
            sha256Hash: 'a'.repeat(64),
            byteSize: 1024,
            rendererVersion: 'react-pdf@4.3.1',
            ruleSetVersion: 'ir35-v2',
            generatedByUserId: 'user_1',
          },
          update: { pdfKey: 'tampered' },
        }),
      ).rejects.toThrow(APPEND_ONLY_ERROR);
    });
  });

  it('allows findMany on ClassificationDocument', async () => {
    const { client, innerQuery } = createMockClient();
    await tenantStore.run({ organizationId: 'org_1', region: 'EU' }, async () => {
      await client.classificationDocument.findMany({ where: { kind: 'SDS' } });
    });
    expect(innerQuery).toHaveBeenCalledOnce();
  });

  it('still permits update on non-append-only models (regression check)', async () => {
    const { client, innerQuery } = createMockClient();
    await tenantStore.run({ organizationId: 'org_1', region: 'EU' }, async () => {
      await client.contractor.update({
        where: { id: 'c_1' },
        data: { legalName: 'Acme Ltd' },
      });
    });
    expect(innerQuery).toHaveBeenCalledOnce();
  });
});
