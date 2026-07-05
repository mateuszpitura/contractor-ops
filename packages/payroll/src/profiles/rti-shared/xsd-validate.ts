import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Non-throwing RTI XSD validate seam (mirrors the IRIS bundle-absent posture).
//
// The HMRC RTI year XSD bundle is an offline download; until it is placed in the
// schema-bundle dir the seam is a passthrough (never throws, so the export ships
// without the schema). When the bundle lands it tightens to a structural check;
// a full XSD validator is wired for RTI direct submission (v7.5).

const BUNDLE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema-bundle');

export interface RtiValidationResult {
  ok: boolean;
  bundlePresent: boolean;
  errors?: string[];
}

/** True once at least one `.xsd` file has been placed in the RTI schema bundle. */
export function hasRtiXsdBundle(): boolean {
  try {
    return readdirSync(BUNDLE_DIR).some(f => f.toLowerCase().endsWith('.xsd'));
  } catch {
    return false;
  }
}

/**
 * Validate RTI XML. Non-throwing: returns `bundlePresent: false, ok: true` when
 * the offline HMRC bundle is absent (the shipping state), and a structural
 * result when it is present.
 */
export function validateRtiXml(xml: string): RtiValidationResult {
  if (!hasRtiXsdBundle()) {
    return { ok: true, bundlePresent: false };
  }
  const errors: string[] = [];
  if (!xml.includes('GovTalkMessage')) {
    errors.push('missing GovTalkMessage envelope');
  }
  return {
    ok: errors.length === 0,
    bundlePresent: true,
    errors: errors.length ? errors : undefined,
  };
}
