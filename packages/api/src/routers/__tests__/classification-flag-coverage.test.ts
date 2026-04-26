// Phase 64 · D-07 — assert every classification procedure uses classificationProcedure.
//
// Catches any future contributor adding a procedure with raw tenantProcedure,
// which would bypass the flag gate (Pitfall 1 from RESEARCH.md).
//
// Strategy: read each classification router module source and verify the
// classificationProcedure import exists and tenantProcedure direct procedure
// calls do not.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const routersDir = new URL('../', import.meta.url);

async function readRouter(name: string): Promise<string> {
  return readFile(fileURLToPath(new URL(`${name}`, routersDir)), 'utf8');
}

describe('Classification flag coverage (Phase 64 D-07)', () => {
  it('classification.ts imports classificationProcedure and not tenantProcedure directly', async () => {
    const src = await readRouter('classification.ts');
    expect(src).toContain("from '../middleware/require-classification-flag.js'");
    expect(src).toContain('classificationProcedure');
    expect(src).not.toMatch(/import.*tenantProcedure.*from.*tenant/);
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
      fileURLToPath(new URL('../middleware/require-classification-flag.ts', routersDir)),
      'utf8',
    );
    expect(src).toContain('CLASSIFICATION_ENGINE_DISABLED');
    expect(src).toContain('FORBIDDEN');
    expect(src).toContain("evaluate('module.classification-engine'");
  });
});
