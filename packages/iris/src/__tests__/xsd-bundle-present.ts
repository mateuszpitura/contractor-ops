// Test-only guard: does the checksum-pinned IRS IRIS XSD bundle actually
// contain schema files yet?
//
// The IRS IRIS XSDs are a human-only download (IRS SOR login) placed at the
// schema-bundle checkpoint. Until they land, any test that asserts XSD
// validation PASSES must skip (it cannot pass without the schema) — but it must
// auto-flip to a real RED→GREEN assertion the moment the .xsd files are present.
// This helper is the runtime detector both validator suites use with
// `it.skipIf` / `it` so the pre-enablement state is safe and the enabled state
// is genuinely tested — no assertion is deleted, weakened, or faked.

import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BUNDLE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'schema-bundle');

/** True once at least one `.xsd` file has been placed in the schema bundle. */
export function hasXsdBundle(): boolean {
  try {
    return readdirSync(BUNDLE_DIR).some(f => f.toLowerCase().endsWith('.xsd'));
  } catch {
    return false;
  }
}

/** Loud HOLD banner surfaced in test output while the bundle is absent. */
export const XSD_HOLD_MESSAGE =
  'HOLD (US-enablement): IRS IRIS XSD bundle absent — XSD-validation-passes assertions are SKIPPED. ' +
  'Download the TY package from the IRS Secure Object Repository into packages/iris/src/schema-bundle/, ' +
  'pin checksums, and these tests auto-flip to a real RED→GREEN assertion.';
