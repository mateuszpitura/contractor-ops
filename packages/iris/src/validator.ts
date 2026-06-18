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

let entryPromise: Promise<EntrySchema | null> | undefined;

/**
 * Lazily load + memoise the entry XSD from the bundle. Returns null when no
 * `.xsd` has been placed yet (the human-action checkpoint is pending).
 */
function loadEntrySchema(): Promise<EntrySchema | null> {
  if (entryPromise !== undefined) return entryPromise;
  entryPromise = (async () => {
    const bundleDir = getBundleDir();
    let files: string[];
    try {
      files = (await readdir(bundleDir)).filter(f => f.toLowerCase().endsWith('.xsd'));
    } catch {
      return null;
    }
    if (files.length === 0) return null;
    // Prefer the 1099-NEC payload schema as the validation entry point; its
    // `<xs:import>`s resolve against `baseUrl` to the sibling manifest XSD.
    // Filenames are known once the real bundle is pinned — revisit then.
    const entry = files.find(f => /1099|nec|payload/i.test(f)) ?? [...files].sort()[0];
    if (entry === undefined) return null;
    const xsd = await readFile(path.join(bundleDir, entry), 'utf8');
    return { xsd, baseUrl: bundleDir + path.sep };
  })();
  return entryPromise;
}

/**
 * Validate an IRIS XML string against the bundled IRS IRIS XSD.
 *
 * Never throws on a bad instance — XML/validation problems surface in
 * `report.errors`. Only re-throws on a corrupt schema bundle (a programmer
 * error, not a validation outcome).
 */
export async function xsdValidate(xml: string): Promise<IrisValidationReport> {
  const entry = await loadEntrySchema();

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
