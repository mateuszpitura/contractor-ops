// packages/einvoice/src/profiles/xrechnung-de/__tests__/validator.test.ts
//
// Phase 61 · Plan 61-03 Task 2 — KoSIT three-layer validator integration
// tests. Replaces the Plan-01 RED scaffold (describe.todo).
//
// Each fixture round-trips through libxmljs2 (XSD) + saxon-js EN16931 SEF +
// saxon-js XRechnung CIUS SEF. Per-layer outcomes are documented in
// `__tests__/fixtures/README.md`.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { KOSIT_RULE_SET_VERSION } from '../constants.js';
import { validateXRechnungCii } from '../validator.js';

const Dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(Dirname, 'fixtures');
const fx = (name: string): string => readFileSync(path.join(FIXTURES, name), 'utf8');

describe('validateXRechnungCii — three-layer KoSIT pipeline', () => {
  it('returns VALID for kosit-positive-minimal.xml across all three layers', async () => {
    const xml = fx('kosit-positive-minimal.xml');

    const report = await validateXRechnungCii(xml);

    expect(report.status).toBe('VALID');
    expect(report.layers).toHaveLength(3);
    for (const layer of report.layers) {
      expect(layer.status).toBe('PASS');
      expect(layer.errors).toEqual([]);
    }
  });

  it('returns VALID for kosit-positive-leitweg.xml (BT-10 populated)', async () => {
    const xml = fx('kosit-positive-leitweg.xml');

    const report = await validateXRechnungCii(xml);

    expect(report.status).toBe('VALID');
    expect(report.layers.every(l => l.status === 'PASS')).toBe(true);
  });

  it('returns INVALID for kosit-negative-missing-bt10.xml with BR-DE-* error in layer 3', async () => {
    const xml = fx('kosit-negative-missing-bt10.xml');

    const report = await validateXRechnungCii(xml);

    expect(report.status).toBe('INVALID');

    const layer3 = report.layers.find(l => l.layer === 'XRECHNUNG-SCH');
    expect(layer3).toBeDefined();
    expect(layer3?.status).toBe('FAIL');
    expect(layer3?.errors.some(e => /^BR-DE-\d+/.test(e.ruleId))).toBe(true);
  });

  it('returns INVALID for kosit-negative-bad-currency.xml with BR-DE-17 in layer 3', async () => {
    const xml = fx('kosit-negative-bad-currency.xml');

    const report = await validateXRechnungCii(xml);

    expect(report.status).toBe('INVALID');

    const layer3 = report.layers.find(l => l.layer === 'XRECHNUNG-SCH');
    expect(layer3).toBeDefined();
    // BR-DE-17 (TypeCode whitelist) is emitted as @flag="warning" by the real
    // KoSIT schematron — see fixtures/README.md "BR-DE-17 deviation note".
    const allLayer3 = [...(layer3?.errors ?? []), ...(layer3?.warnings ?? [])];
    expect(allLayer3.some(i => i.ruleId === 'BR-DE-17')).toBe(true);
  });

  it('short-circuits layer 2/3 with SKIPPED when layer 1 XSD fails', async () => {
    const malformed = '<not><well-formed>';

    const report = await validateXRechnungCii(malformed);

    expect(report.status).toBe('INVALID');
    const xsd = report.layers.find(l => l.layer === 'XSD');
    expect(xsd?.status).toBe('FAIL');
    expect(xsd?.errors.length).toBeGreaterThan(0);

    const en = report.layers.find(l => l.layer === 'EN16931-SCH');
    const xr = report.layers.find(l => l.layer === 'XRECHNUNG-SCH');
    expect(en?.status).toBe('SKIPPED');
    expect(xr?.status).toBe('SKIPPED');
    expect(en?.errors).toEqual([]);
    expect(xr?.errors).toEqual([]);
  });

  it('emits ruleSetVersion equal to KOSIT_RULE_SET_VERSION constant', async () => {
    const report = await validateXRechnungCii(fx('kosit-positive-minimal.xml'));
    expect(report.ruleSetVersion).toBe(KOSIT_RULE_SET_VERSION);
  });
});
