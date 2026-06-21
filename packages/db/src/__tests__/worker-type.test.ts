// withWorkerTypeDefault extension contract (terminal RED until the extension
// lands).
//
// RED until `packages/db/src/worker-type.ts` is created exporting
// `withWorkerTypeDefault` — a Prisma `$extends({ query })` link that injects
// `workerType: 'CONTRACTOR'` into reads on the `Worker` base model when the
// caller has not already specified `workerType` (explicit-where-wins), and
// leaves non-Worker reads untouched. The import below resolves to a
// not-yet-existing module, so the suite fails at module resolution (Cannot find
// module). It pins the inject-default + explicit-where-wins behavior across
// every read op the extension must cover, mirroring the soft-delete extension's
// scalar-injection idiom (which always injects; this one opts out on an
// explicit where).

import { describe, expect, it } from 'vitest';

import { withWorkerTypeDefault } from '../worker-type.js';

const READ_OPS = [
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
] as const;

/**
 * A minimal Prisma-extensible stub. `$extends({ query })` returns a client whose
 * model methods route through the registered `$allOperations` (or per-op)
 * handler, recording the args the handler forwards to the underlying `query`.
 * This lets the test observe exactly what the extension injects without a real
 * Prisma engine.
 */
function makeExtensibleStub() {
  const forwarded: Array<{ model: string; operation: string; args: unknown }> = [];

  const stub = {
    $extends(ext: {
      query?: {
        $allOperations?: (params: {
          model?: string;
          operation: string;
          args: unknown;
          query: (args: unknown) => Promise<unknown>;
        }) => Promise<unknown>;
      };
    }) {
      const handler = ext.query?.$allOperations;

      function invoke(model: string, operation: string, args: unknown) {
        const query = async (finalArgs: unknown) => {
          forwarded.push({ model, operation, args: finalArgs });
          return finalArgs;
        };
        if (!handler) return query(args);
        return handler({ model, operation, args, query });
      }

      const modelDelegate = (model: string) =>
        Object.fromEntries(READ_OPS.map(op => [op, (args: unknown) => invoke(model, op, args)]));

      return {
        worker: modelDelegate('Worker'),
        contractor: modelDelegate('Contractor'),
      };
    },
  };

  return { stub, forwarded };
}

describe('withWorkerTypeDefault extension', () => {
  it('is a function that wraps an extensible client', () => {
    expect(withWorkerTypeDefault).toBeTypeOf('function');
  });

  for (const op of READ_OPS) {
    it(`injects workerType='CONTRACTOR' on worker.${op} when where omits workerType`, async () => {
      const { stub, forwarded } = makeExtensibleStub();
      const client = withWorkerTypeDefault(stub as never) as Record<
        string,
        Record<string, (args: unknown) => Promise<unknown>>
      >;

      await client.worker[op]({ where: { organizationId: 'org_1' } });

      const call = forwarded.at(-1);
      expect(call?.model).toBe('Worker');
      expect(call?.args).toMatchObject({
        where: { organizationId: 'org_1', workerType: 'CONTRACTOR' },
      });
    });

    it(`leaves an explicit workerType untouched on worker.${op} (explicit-where-wins)`, async () => {
      const { stub, forwarded } = makeExtensibleStub();
      const client = withWorkerTypeDefault(stub as never) as Record<
        string,
        Record<string, (args: unknown) => Promise<unknown>>
      >;

      await client.worker[op]({ where: { organizationId: 'org_1', workerType: 'EMPLOYEE' } });

      const call = forwarded.at(-1);
      expect((call?.args as { where: { workerType: string } }).where.workerType).toBe('EMPLOYEE');
    });
  }

  it('does not modify a non-Worker model read (Contractor reads are inherently contractor-only)', async () => {
    const { stub, forwarded } = makeExtensibleStub();
    const client = withWorkerTypeDefault(stub as never) as Record<
      string,
      Record<string, (args: unknown) => Promise<unknown>>
    >;

    await client.contractor.findMany({ where: { organizationId: 'org_1' } });

    const call = forwarded.at(-1);
    expect(call?.model).toBe('Contractor');
    expect(call?.args).toEqual({ where: { organizationId: 'org_1' } });
    expect((call?.args as { where: Record<string, unknown> }).where).not.toHaveProperty(
      'workerType',
    );
  });

  it('injects a fresh where when none is supplied on a Worker read', async () => {
    const { stub, forwarded } = makeExtensibleStub();
    const client = withWorkerTypeDefault(stub as never) as Record<
      string,
      Record<string, (args: unknown) => Promise<unknown>>
    >;

    await client.worker.count({});

    const call = forwarded.at(-1);
    expect((call?.args as { where?: Record<string, unknown> }).where).toMatchObject({
      workerType: 'CONTRACTOR',
    });
  });
});
