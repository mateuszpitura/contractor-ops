/**
 * Wave-0 load-bearing spike: does a Zod-4 schema authored in
 * `@contractor-ops/validators` (plain `zod`) register into the OpenAPI 3.1
 * document produced by `@hono/zod-openapi`'s `getOpenAPI31Document()`?
 *
 * This resolves the single highest-risk unknown of the phase (RESEARCH seam A2 /
 * Pitfall 1) and locks WHERE every later route DTO lives. The test asserts the
 * ACTUAL behaviour of every branch so it documents reality rather than a guess:
 *
 *   - Query PARAMETERS surface into `paths[...].get.parameters` from a
 *     validators-authored `.strict()` schema (the load-bearing fact for reads).
 *   - A NAMED `components.schemas` entry appears for a RESPONSE schema when it
 *     carries a Zod-4 native `.meta({ id })` — regardless of whether the schema
 *     was created by the validators `zod` or the package `z`. This is the crux
 *     that decides Verdict A (validators-authored DTOs) vs Verdict B (app-layer).
 *
 * `@contractor-ops/public-api` deliberately does NOT depend on `zod` directly
 * (it is owned by `@contractor-ops/validators`), so the validators-authored
 * schema is imported from the real package — a faithful test of the seam.
 *
 * Kept in the tree as executable regression documentation. No console.*.
 */

import { publicApiContractorListInputSchema } from '@contractor-ops/validators/public-api';
import { createRoute, OpenAPIHono, z as zHono } from '@hono/zod-openapi';
import { describe, expect, it } from 'vitest';

// A real `@contractor-ops/validators` object schema, made `.strict()` here —
// authored entirely with the validators-owned (plain) `zod`. Schema under test.
const validatorsAuthoredQuery = publicApiContractorListInputSchema.strict();

// A validators-authored RESPONSE schema carrying a Zod-4 NATIVE `.meta({ id })`
// name — no package `z` involved. Query params are always inlined, so the
// named-component question is only meaningful for response/body schemas.
const validatorsResponseNamed = publicApiContractorListInputSchema
  .strict()
  .meta({ id: 'SpikeValidatorsMetaNamed' });

// Control: package-provided `z` + `.openapi('Name')` response schema.
const honoResponseNamed = zHono
  .object({ ok: zHono.boolean() })
  .openapi('SpikeHonoAuthoredResponse');

// biome-ignore lint/suspicious/noExplicitAny: throwaway spike harness — plain
// validators schemas and package-`z` schemas are fed through the same builder.
function buildDoc(querySchema: any, responseSchema: any) {
  const app = new OpenAPIHono();
  const route = createRoute({
    method: 'get',
    path: '/spike',
    request: { query: querySchema },
    responses: {
      200: {
        content: { 'application/json': { schema: responseSchema } },
        description: 'spike',
      },
    },
  });
  app.openapi(route, c => c.json({ ok: true } as never, 200));
  return app.getOpenAPI31Document({
    openapi: '3.1.0',
    info: { title: 'spike', version: '1.0.0' },
  });
}

// The observed verdict, pinned so a library-behaviour regression fails loudly.
// Confirmed by the spike run and recorded in 98-SPIKE-FINDINGS.md.
const SPIKE_VALIDATORS_META_REGISTERS = true;

describe('OpenAPI metadata spike — validators Zod-4 ↔ @hono/zod-openapi', () => {
  it('emits an OpenAPI 3.1.x document (INTEG-API-02 target reachable)', () => {
    const doc = buildDoc(validatorsAuthoredQuery, honoResponseNamed);
    expect(String(doc.openapi)).toMatch(/^3\.1/);
  });

  it('surfaces query parameters from a validators-authored .strict() schema', () => {
    const doc = buildDoc(validatorsAuthoredQuery, honoResponseNamed);
    const params = doc.paths?.['/spike']?.get?.parameters ?? [];
    const names = params.map(p => (p as { name?: string }).name);
    // Load-bearing fact for reads: the validators schema's fields surface as
    // query parameters even though it was created by plain (validators) zod.
    expect(names).toContain('cursor');
    expect(names).toContain('sort');
    for (const p of params) {
      expect((p as { in?: string }).in).toBe('query');
    }
  });

  it('registers a NAMED component for a validators .meta({id}) response schema (Verdict A)', () => {
    const metaDoc = buildDoc(validatorsAuthoredQuery, validatorsResponseNamed);
    const honoDoc = buildDoc(validatorsAuthoredQuery, honoResponseNamed);

    const metaComponents = Object.keys(metaDoc.components?.schemas ?? {});
    const honoComponents = Object.keys(honoDoc.components?.schemas ?? {});

    // Control: package `z` + `.openapi('Name')` registers a named component.
    expect(honoComponents).toContain('SpikeHonoAuthoredResponse');

    // Verdict: a validators schema with a Zod-4 native `.meta({ id })` registers
    // a named component in the derived 3.1 doc — validators can author named
    // DTOs directly, no package `z` required. Pinned so a regression flips it.
    expect(metaComponents.includes('SpikeValidatorsMetaNamed')).toBe(
      SPIKE_VALIDATORS_META_REGISTERS,
    );
  });
});
