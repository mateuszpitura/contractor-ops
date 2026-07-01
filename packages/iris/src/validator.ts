// IRIS XML XSD validator.
//
// Round-trips an IRIS XML string through libxmljs2 against the bundled IRS
// IRIS XSD and reports VALID / INVALID with per-error detail, mirroring the
// packages/einvoice KoSIT layer-1 report shape.
//
// SECURITY:
//   * libxmljs2.parseXml uses { nonet: true, baseUrl: <bundle dir> } so an
//     external `<xs:import schemaLocation="http://…">` can never trigger an
//     outbound SSRF request. The default `noent: false` keeps external-entity
//     expansion off (XXE mitigation).
//   * The bundle dir is resolved lazily (bundler SSR strips import.meta paths
//     at module-load), and only `.xsd` files inside src/schema-bundle are ever
//     read — no user-supplied schema path.
//
// The IRS IRIS XSDs are a human-only download (IRS SOR login) placed at the
// schema-bundle checkpoint; until they land, validation reports a missing
// bundle rather than throwing. See src/schema-bundle/README.md.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createLogger } from '@contractor-ops/logger';
import libxmljs from 'libxmljs2';
import type { IrisValidationError, IrisValidationReport } from './types.js';

const log = createLogger({ service: 'iris.validator' });

function getBundleDir(): string {
  return path.join(path.dirname(new URL(import.meta.url).pathname), 'schema-bundle');
}

interface EntrySchema {
  xsd: string;
  baseUrl: string;
}

/**
 * Which IRIS form's XSD to validate against. Each form (1099-NEC, 1042-S) has
 * its own payload schema inside the same bundle, selected by filename.
 */
type IrisForm = '1099' | '1042s';

/**
 * Filename matcher for each form's payload XSD entry point. Its `<xs:import>`s
 * resolve against `baseUrl` to the sibling manifest XSD. Real filenames are
 * known once the pinned bundle lands — revisit then.
 */
const ENTRY_MATCHERS: Record<IrisForm, RegExp> = {
  '1099': /1099|nec/i,
  '1042s': /1042/i,
};

const entryPromises = new Map<IrisForm, Promise<EntrySchema | null>>();

/**
 * Lazily load + memoise the entry XSD for `form` from the bundle. Returns null
 * when no matching `.xsd` has been placed yet (the human-action checkpoint is
 * pending). A form-specific entry is never substituted from another form's
 * schema — a missing 1042-S XSD reports missing rather than validating against
 * the 1099 schema.
 */
function loadEntrySchema(form: IrisForm): Promise<EntrySchema | null> {
  const cached = entryPromises.get(form);
  if (cached !== undefined) return cached;
  const promise = (async () => {
    const bundleDir = getBundleDir();
    let files: string[];
    try {
      files = (await readdir(bundleDir)).filter(f => f.toLowerCase().endsWith('.xsd'));
    } catch {
      return null;
    }
    if (files.length === 0) return null;
    const entry = files.find(f => ENTRY_MATCHERS[form].test(f));
    if (entry === undefined) return null;
    const xsd = await readFile(path.join(bundleDir, entry), 'utf8');
    return { xsd, baseUrl: bundleDir + path.sep };
  })();
  entryPromises.set(form, promise);
  return promise;
}

/**
 * Core: validate an IRIS XML string against the bundled entry XSD for `form`.
 *
 * Never throws on a bad instance — XML/validation problems surface in
 * `report.errors`. Only re-throws on a corrupt schema bundle (a programmer
 * error, not a validation outcome).
 */
async function validateAgainstBundle(xml: string, form: IrisForm): Promise<IrisValidationReport> {
  const entry = await loadEntrySchema(form);

  if (entry === null) {
    log.warn(
      { bundleDir: getBundleDir() },
      'IRIS validator: no XSD bundle present — place the IRS IRIS schemas at the human-action checkpoint',
    );
    return {
      status: 'INVALID',
      errors: [
        {
          code: 'XSD-BUNDLE-MISSING',
          message:
            'IRS IRIS XSD bundle not present — download from IRS SOR and place under src/schema-bundle (see README.md).',
          severity: 'fatal',
        },
      ],
    };
  }

  let xsdDoc: libxmljs.Document;
  try {
    xsdDoc = libxmljs.parseXml(entry.xsd, { baseUrl: entry.baseUrl, nonet: true });
  } catch (err) {
    // A broken bundle is a programmer error, not a validation failure — re-throw.
    throw new Error(
      `IRIS validator: failed to parse bundled IRIS XSD (${
        err instanceof Error ? err.message : String(err)
      })`,
    );
  }

  let instanceDoc: libxmljs.Document;
  try {
    instanceDoc = libxmljs.parseXml(xml, { nonet: true });
  } catch (err) {
    return {
      status: 'INVALID',
      errors: [
        {
          code: 'XSD-PARSE',
          message: `XML parse error: ${err instanceof Error ? err.message : String(err)}`,
          severity: 'fatal',
        },
      ],
    };
  }

  const valid = instanceDoc.validate(xsdDoc);
  if (valid) return { status: 'VALID', errors: [] };

  const errors: IrisValidationError[] = (instanceDoc.validationErrors ?? []).map(e => ({
    code: 'XSD',
    severity: 'error',
    message:
      typeof e === 'object' && e && 'message' in e
        ? String((e as { message: unknown }).message).trim()
        : String(e).trim(),
  }));
  return { status: 'INVALID', errors };
}

/**
 * Validate a 1099-NEC IRIS XML string against the bundled IRS IRIS XSD.
 *
 * Never throws on a bad instance — problems surface in `report.errors`.
 */
export function xsdValidate(xml: string): Promise<IrisValidationReport> {
  return validateAgainstBundle(xml, '1099');
}

/**
 * Validate a 1042-S IRIS XML string against the bundled IRS Publication 1187
 * XSD. Uses libxmljs2 `{ nonet: true }` (no SSRF) with the default
 * `noent: false` (no XXE), reading the checksum-pinned schema bundle.
 *
 * Never throws on a bad instance — problems surface in `report.errors`.
 */
export function xsdValidate1042S(xml: string): Promise<IrisValidationReport> {
  return validateAgainstBundle(xml, '1042s');
}
