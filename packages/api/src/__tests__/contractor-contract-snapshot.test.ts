// contractor.* route-shape contract lock.
//
// Captures the full set of `contractor.*` tRPC procedure names plus each
// procedure's input/output JSON-Schema shape against the CURRENT router, so any
// later refactor that drops, renames, or reshapes a contractor procedure fails
// CI on a snapshot diff. Introspection is read-only (`appRouter._def.procedures`
// is a flat Record<dotted-path, AnyProcedure> in tRPC v11) — no procedure is
// invoked, so importing the router only needs the heavy app modules stubbed
// enough to evaluate without touching a database or network.
//
// The shape serializer uses zod's native `z.toJSONSchema` (zod 4) on each
// procedure's input/output schema. When a procedure has no input or no declared
// output it is recorded explicitly (`null`) so adding or removing a schema is a
// visible diff rather than a silent absence.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

// The router graph pulls in db + auth at import time. Stub both so the module
// evaluates without a live Postgres/Redis/Unleash connection — the test never
// calls a procedure, it only reads `_def`.
vi.mock('@contractor-ops/db', () => {
  const noopClient = new Proxy(
    {},
    {
      get: () => () => undefined,
    },
  );
  return {
    prisma: noopClient,
    prismaRaw: noopClient,
    withRlsTransactions: <T>(c: T) => c,
    withRlsReads: <T>(c: T) => c,
    tenantStore: { run: (_ctx: unknown, fn: () => unknown) => fn(), getStore: vi.fn() },
    withTenantScope: vi.fn((c: unknown) => c),
    withSoftDelete: vi.fn((c: unknown) => c),
    createTenantClient: vi.fn(() => noopClient),
    createTenantClientFrom: vi.fn(() => noopClient),
    getRegionalClient: vi.fn(() => noopClient),
    preWarmRegionalClients: vi.fn(),
  };
});

vi.mock('@contractor-ops/auth', () => ({
  auth: { api: { getSession: vi.fn(), hasPermission: vi.fn() } },
  authApi: { getSession: vi.fn(), hasPermission: vi.fn(), getFullOrganization: vi.fn() },
}));

import { appRouter } from '../root';

// A tRPC procedure carries its input/output zod schemas on `_def`. The field
// names have shifted across v11 minors (`inputs`/`input`, `output`), so probe
// the known locations defensively and fall back to `null` when absent.
function extractSchema(def: Record<string, unknown>, kind: 'input' | 'output'): unknown {
  if (kind === 'input') {
    const inputs = def.inputs;
    if (Array.isArray(inputs) && inputs.length > 0) return inputs[0];
    return def.input ?? null;
  }
  return def.output ?? null;
}

function serializeProcShape(proc: unknown): { input: unknown; output: unknown } {
  const def = (proc as { _def?: Record<string, unknown> })._def ?? {};
  const toShape = (schema: unknown): unknown => {
    if (schema == null) return null;
    try {
      return z.toJSONSchema(schema as z.ZodType, { unrepresentable: 'any' });
    } catch {
      // A schema zod cannot serialize (custom refinements, lazy cycles) still
      // contributes a stable marker so the procedure's presence is locked even
      // when its full shape is not representable.
      return { _unrepresentable: true };
    }
  };
  return {
    input: toShape(extractSchema(def, 'input')),
    output: toShape(extractSchema(def, 'output')),
  };
}

describe('contractor.* route-shape contract', () => {
  let originalTz: string | undefined;

  beforeAll(() => {
    originalTz = process.env.TZ;
    process.env.TZ = 'UTC';
  });

  afterAll(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it('exposes appRouter._def.procedures as the introspection source', () => {
    expect(appRouter._def.procedures).toBeTypeOf('object');
  });

  it('freezes the sorted contractor.* procedure name list', () => {
    const names = Object.keys(appRouter._def.procedures)
      .filter(path => path.startsWith('contractor.'))
      .sort();

    expect(names.length).toBeGreaterThan(0);
    expect(names).toMatchSnapshot();
  });

  it('freezes each contractor.* procedure input/output shape', () => {
    const shapes: Record<string, { input: unknown; output: unknown }> = {};
    for (const [path, proc] of Object.entries(appRouter._def.procedures)) {
      if (!path.startsWith('contractor.')) continue;
      shapes[path] = serializeProcShape(proc);
    }

    expect(Object.keys(shapes).length).toBeGreaterThan(0);
    expect(shapes).toMatchSnapshot();
  });
});
