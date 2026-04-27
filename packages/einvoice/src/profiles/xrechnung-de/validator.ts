// Phase 61 · Plan 61-03 Task 2 — KoSIT three-layer XRechnung CII validator.
//
// Pipeline:
//   Layer 1 — XSD schema validation       (libxmljs2 ↔ CII D16B XSDs)
//   Layer 2 — EN 16931 Schematron         (saxon-js ↔ EN16931-CII SEF)
//   Layer 3 — XRechnung CIUS Schematron   (saxon-js ↔ XRechnung-CII SEF)
//
// Layer 1 short-circuits the rest: if the document isn't even shaped like a
// CII envelope, running schematron over it would emit confusing rule errors
// instead of the actual problem. Layers 2 and 3 always run when layer 1 passes
// (we want both rule-set reports surfaced; schematrons are independent).
//
// Bundle artefacts (SEFs + XSDs) are loaded once at module init via a cached
// promise — the recompile-kosit-schematron.ts CI guard pins their SHA-256.
//
// SECURITY:
//   * libxmljs2.parseXml uses { nonet: true, baseUrl: <bundle dir> } so
//     external `<xs:import schemaLocation="http://...">` is impossible
//     (T-61-03-02 SSRF mitigation). The default `noent: false` means entities
//     are NOT expanded (T-61-03-01 XXE mitigation).
//   * SaxonJS.transform consumes only the two SEFs under validator-bundle/;
//     no user-supplied stylesheet is ever loaded (T-61-03-06 RCE mitigation).
//   * SVRL is parsed via the XXE-safe normaliser (T-61-03-01 second line).

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from '@contractor-ops/logger';
import libxmljs from 'libxmljs2';
import SaxonJS from 'saxon-js';

import { KOSIT_RULE_SET_VERSION } from './constants.js';
import type { NormalisedSvrl, ValidationIssue } from './svrl-normalizer.js';
import { normaliseSvrl } from './svrl-normalizer.js';

const log = createLogger({ service: 'einvoice.xrechnung-de.validator' });

const Dirname = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE_DIR = path.join(Dirname, 'validator-bundle');
const XSD_DIR = path.join(BUNDLE_DIR, 'CII-D16B-schema');

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type { ValidationIssue } from './svrl-normalizer.js';

export type ValidationLayerName = 'XSD' | 'EN16931-SCH' | 'XRECHNUNG-SCH';
export type ValidationLayerStatus = 'PASS' | 'FAIL' | 'SKIPPED';

export interface ValidationLayerReport {
  layer: ValidationLayerName;
  status: ValidationLayerStatus;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  infos: ValidationIssue[];
}

export interface XRechnungValidationReport {
  status: 'VALID' | 'INVALID' | 'WARNINGS';
  ruleSetVersion: string;
  layers: ValidationLayerReport[];
}

// ---------------------------------------------------------------------------
// Lazy artefact loader (top-level await may be unsupported in some bundler
// configs — use a memoised promise to keep cold-start determinism).
// ---------------------------------------------------------------------------

interface BundleArtefacts {
  en16931Sef: object;
  xrechnungSef: object;
  ciiXsd: string;
}

let bundlePromise: Promise<BundleArtefacts> | undefined;

function loadBundle(): Promise<BundleArtefacts> {
  // biome-ignore lint/nursery/noMisusedPromises: memoized Promise — return-cached-or-create pattern, never awaited inside the conditional
  if (bundlePromise) return bundlePromise;
  bundlePromise = (async () => {
    const [en16931Raw, xrechnungRaw, ciiXsd] = await Promise.all([
      readFile(path.join(BUNDLE_DIR, 'EN16931-CII-validation.sef.json'), 'utf8'),
      readFile(path.join(BUNDLE_DIR, 'XRechnung-CII-validation.sef.json'), 'utf8'),
      readFile(path.join(XSD_DIR, 'CrossIndustryInvoice_100pD16B.xsd'), 'utf8'),
    ]);
    return {
      en16931Sef: JSON.parse(en16931Raw) as object,
      xrechnungSef: JSON.parse(xrechnungRaw) as object,
      ciiXsd,
    };
  })();
  return bundlePromise;
}

// ---------------------------------------------------------------------------
// Per-layer runners
// ---------------------------------------------------------------------------

interface XsdRun {
  ok: boolean;
  errors: ValidationIssue[];
}

function runXsd(xml: string, ciiXsd: string): XsdRun {
  // Pin baseUrl + disable network so attacker-controlled `<xs:import
  // schemaLocation="http://…">` cannot trigger an outbound request (T-61-03-02).
  let xsdDoc: libxmljs.Document;
  let instanceDoc: libxmljs.Document;
  try {
    xsdDoc = libxmljs.parseXml(ciiXsd, {
      baseUrl: XSD_DIR + path.sep,
      nonet: true,
    });
  } catch (err) {
    // A broken bundle is a programmer error, not a validation failure — re-throw.
    throw new Error(
      `XRechnung validator: failed to parse bundled CII D16B XSD (${
        err instanceof Error ? err.message : String(err)
      })`,
    );
  }

  try {
    instanceDoc = libxmljs.parseXml(xml, { nonet: true });
  } catch (err) {
    return {
      ok: false,
      errors: [
        {
          ruleId: 'XSD-PARSE',
          xpath: '',
          severity: 'fatal',
          message: `XML parse error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  }

  const valid = instanceDoc.validate(xsdDoc);
  if (valid) return { ok: true, errors: [] };

  const errors: ValidationIssue[] = (instanceDoc.validationErrors ?? []).map(e => ({
    ruleId: 'XSD',
    xpath: '',
    severity: 'fatal',
    message:
      typeof e === 'object' && e && 'message' in e
        ? String((e as { message: unknown }).message).trim()
        : String(e).trim(),
  }));
  return { ok: false, errors };
}

async function runSchematron(
  layer: 'EN16931-SCH' | 'XRECHNUNG-SCH',
  sef: object,
  xml: string,
): Promise<NormalisedSvrl> {
  const result = (await SaxonJS.transform({
    stylesheetInternal: sef,
    sourceText: xml,
    destination: 'serialized',
  })) as { principalResult?: string };
  const svrl = result.principalResult ?? '';
  if (!svrl) {
    log.warn({ layer }, 'KoSIT validator: empty principalResult from SaxonJS.transform');
  }
  return normaliseSvrl(svrl);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run the KoSIT three-layer pipeline against a UTF-8 XRechnung CII XML string
 * and return a typed `XRechnungValidationReport`. Never throws on validation
 * failure — only on programmer errors (corrupt bundle, saxon-js internal
 * failure). Validation problems surface in `report.layers[].errors[]`.
 */
export async function validateXRechnungCii(xml: string): Promise<XRechnungValidationReport> {
  const { en16931Sef, xrechnungSef, ciiXsd } = await loadBundle();
  const layers: ValidationLayerReport[] = [];

  // Layer 1 — XSD
  const xsd = runXsd(xml, ciiXsd);
  layers.push({
    layer: 'XSD',
    status: xsd.ok ? 'PASS' : 'FAIL',
    errors: xsd.errors,
    warnings: [],
    infos: [],
  });

  if (!xsd.ok) {
    const skipped = (layer: ValidationLayerName): ValidationLayerReport => ({
      layer,
      status: 'SKIPPED',
      errors: [],
      warnings: [],
      infos: [],
    });
    layers.push(skipped('EN16931-SCH'), skipped('XRECHNUNG-SCH'));
    return {
      status: 'INVALID',
      ruleSetVersion: KOSIT_RULE_SET_VERSION,
      layers,
    };
  }

  // Layer 2 — EN 16931 Schematron
  const en = await runSchematron('EN16931-SCH', en16931Sef, xml);
  layers.push({
    layer: 'EN16931-SCH',
    status: en.errors.length > 0 ? 'FAIL' : 'PASS',
    errors: en.errors,
    warnings: en.warnings,
    infos: en.infos,
  });

  // Layer 3 — XRechnung CIUS Schematron
  const xr = await runSchematron('XRECHNUNG-SCH', xrechnungSef, xml);
  layers.push({
    layer: 'XRECHNUNG-SCH',
    status: xr.errors.length > 0 ? 'FAIL' : 'PASS',
    errors: xr.errors,
    warnings: xr.warnings,
    infos: xr.infos,
  });

  const hasErrors = layers.some(l => l.errors.length > 0);
  const hasWarnings = layers.some(l => l.warnings.length > 0);
  const status: XRechnungValidationReport['status'] = hasErrors
    ? 'INVALID'
    : hasWarnings
      ? 'WARNINGS'
      : 'VALID';

  return {
    status,
    ruleSetVersion: KOSIT_RULE_SET_VERSION,
    layers,
  };
}
