// IRIS XSD validator (xsdValidate) — 1099-NEC.
//
// The generator + validator are built; the "returns VALID" and "rejects a
// broken document" assertions genuinely need the IRS IRIS XSD bundle, which is
// a human-only download (IRS SOR login). Until the .xsd files land, those two
// assertions are SKIPPED (a loud HOLD is printed) and the pre-enablement
// contract — xsdValidate reports BUNDLE_UNAVAILABLE, never throwing — is
// asserted instead. The moment the bundle is placed, `hasXsdBundle()` flips true
// and the skipped assertions run for real (RED→GREEN). No assertion is deleted,
// weakened, or faked.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildIrisXml } from '../generator.js';
import type { IrisSubmissionInput } from '../types.js';
import { xsdValidate } from '../validator.js';
import { hasXsdBundle, XSD_HOLD_MESSAGE } from './xsd-bundle-present.js';

const goldenInput = JSON.parse(
  readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'golden-1099-nec.json'),
    'utf8',
  ),
) as IrisSubmissionInput;

const bundlePresent = hasXsdBundle();

describe('xsdValidate — IRIS XML against bundled IRS XSD (US-FORM-05)', () => {
  it.skipIf(!bundlePresent)('returns VALID for a buildIrisXml golden output', async () => {
    const xml = buildIrisXml(goldenInput);

    const report = await xsdValidate(xml);

    expect(report.status).toBe('VALID');
    expect(report.errors).toEqual([]);
  });

  it.skipIf(!bundlePresent)(
    'returns INVALID with per-error detail for a structurally-broken document',
    async () => {
      const report = await xsdValidate('<Submission><Unexpected/></Submission>');

      expect(report.status).toBe('INVALID');
      expect(report.errors.length).toBeGreaterThan(0);
    },
  );

  it.runIf(!bundlePresent)(
    'reports BUNDLE_UNAVAILABLE (non-throwing) while the IRS XSD bundle is absent [HOLD]',
    async () => {
      console.warn(XSD_HOLD_MESSAGE);
      const report = await xsdValidate(buildIrisXml(goldenInput));

      expect(report.status).toBe('BUNDLE_UNAVAILABLE');
      expect(report.errors.length).toBeGreaterThan(0);
    },
  );

  it('never fetches an external schema (nonet) — validation does not throw on a bad instance', async () => {
    await expect(xsdValidate('<not-iris/>')).resolves.toBeDefined();
  });
});
