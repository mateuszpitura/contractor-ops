// Assert every classification procedure uses classificationProcedure.
//
// Catches any future contributor adding a procedure with raw tenantProcedure,
// which would bypass the flag gate.
//
// Strategy: read each classification router module source and verify the
// classificationProcedure import exists and tenantProcedure direct procedure
// calls do not.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// All classification routers live under routers/compliance/ after the domain split.
const routersDir = new URL('../compliance/', import.meta.url);

async function readRouter(name: string): Promise<string> {
  return readFile(fileURLToPath(new URL(`${name}`, routersDir)), 'utf8');
}

describe('Classification flag coverage (Phase 64 D-07)', () => {
  // The single classification.ts router was split into draft/submit/read
  // sub-routers, all merged by the classification.ts barrel. Every procedure
  // across the split must stay flag-gated: it must be defined on one of the
  // gated factories (classificationProcedure, or factories derived from it —
  // contractorUpdateProcedure = classificationProcedure.use(...), or
  // adminProcedure, which is gated at the root.ts conditional-registration
  // layer because the whole classificationRouter is mounted behind the flag).
  // No procedure may be defined directly on raw tenant/protected/public procedures.
  const CLASSIFICATION_SUB_ROUTERS = [
    'classification-draft.ts',
    'classification-read.ts',
    'classification-submit.ts',
  ] as const;

  const GATED_FACTORIES = [
    'classificationProcedure',
    'contractorUpdateProcedure',
    'adminProcedure',
  ] as const;
  const UNGATED_FACTORIES = ['tenantProcedure', 'protectedProcedure', 'publicProcedure'] as const;
  const ALL_FACTORIES = [...GATED_FACTORIES, ...UNGATED_FACTORIES];

  // Matches a tRPC procedure definition `<name>: <factory>` where <factory> is
  // one of the known procedure factories. Constraining the value side keeps the
  // regex from matching ordinary object properties (`id: true`, `sector: null`).
  const PROCEDURE_DEF = new RegExp(
    String.raw`^\s+([a-zA-Z][a-zA-Z0-9]*):\s*(${ALL_FACTORIES.join('|')})\b`,
    'gm',
  );

  it('classification.ts barrel merges the draft, submit, and read sub-routers', async () => {
    const src = await readRouter('classification.ts');
    expect(src).toContain('mergeRouters');
    expect(src).toContain('classificationDraftRouter');
    expect(src).toContain('classificationSubmitRouter');
    expect(src).toContain('classificationReadRouter');
  });

  it.each(
    CLASSIFICATION_SUB_ROUTERS,
  )('%s defines every procedure on a flag-gated factory and never raw tenantProcedure', async name => {
    const src = await readRouter(name);

    // No sub-router may import the raw tenant procedure factory — classification
    // procedures flow through classificationProcedure (directly, or via the
    // derived contractorUpdateProcedure / adminProcedure factories).
    expect(src).not.toMatch(/import.*\btenantProcedure\b.*from/);

    const factories: string[] = [];
    for (const match of src.matchAll(PROCEDURE_DEF)) {
      factories.push(match[2] as string);
    }
    // Guard against a regex that silently matches nothing after a refactor —
    // every sub-router defines at least one procedure.
    expect(factories.length).toBeGreaterThan(0);

    // Every procedure must be defined on a flag-gated factory, never a raw one.
    for (const factory of factories) {
      expect(UNGATED_FACTORIES).not.toContain(factory);
      expect(GATED_FACTORIES).toContain(factory);
    }
  });

  it('classification-dashboard.ts imports classificationProcedure', async () => {
    const src = await readRouter('classification-dashboard.ts');
    expect(src).toContain('classificationProcedure');
    expect(src).not.toMatch(/import.*tenantProcedure.*from.*tenant/);
  });

  it('classification-document.tsx imports classificationProcedure', async () => {
    const src = await readRouter('classification-document.tsx');
    expect(src).toContain('classificationProcedure');
    expect(src).not.toMatch(/import.*tenantProcedure.*from.*tenant/);
  });

  it('ir35-chain.ts imports classificationProcedure', async () => {
    const src = await readRouter('ir35-chain.ts');
    expect(src).toContain('classificationProcedure');
    expect(src).not.toMatch(/import.*tenantProcedure.*from.*tenant/);
  });

  it('ir35-other-client-attestation.ts imports classificationProcedure', async () => {
    const src = await readRouter('ir35-other-client-attestation.ts');
    expect(src).toContain('classificationProcedure');
    expect(src).not.toMatch(/import.*tenantProcedure.*from.*tenant/);
  });

  it('economic-dependency-alert.ts imports classificationProcedure', async () => {
    const src = await readRouter('economic-dependency-alert.ts');
    expect(src).toContain('classificationProcedure');
    expect(src).not.toMatch(/import.*tenantProcedure.*from.*tenant/);
  });

  it('reassessment-trigger.ts imports classificationProcedure', async () => {
    const src = await readRouter('reassessment-trigger.ts');
    expect(src).toContain('classificationProcedure');
    expect(src).not.toMatch(/import.*tenantProcedure.*from.*tenant/);
  });

  it('statusfeststellungsverfahren.ts imports classificationProcedure', async () => {
    const src = await readRouter('statusfeststellungsverfahren.ts');
    expect(src).toContain('classificationProcedure');
    expect(src).not.toMatch(/import.*tenantProcedure.*from.*tenant/);
  });

  it('require-classification-flag middleware throws FORBIDDEN with CLASSIFICATION_ENGINE_DISABLED', async () => {
    const src = await readFile(
      // require-classification-flag.ts lives at packages/api/src/middleware/.
      // routersDir resolves to routers/compliance/, so we go up two levels.
      fileURLToPath(new URL('../../middleware/require-classification-flag.ts', routersDir)),
      'utf8',
    );
    expect(src).toContain('CLASSIFICATION_ENGINE_DISABLED');
    expect(src).toContain('FORBIDDEN');
    expect(src).toContain("evaluate('module.classification-engine'");
  });
});
