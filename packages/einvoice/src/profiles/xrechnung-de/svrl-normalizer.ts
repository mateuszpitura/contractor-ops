// SVRL normaliser.
//
// Flattens a Schematron Validation Report Language (SVRL) document — emitted
// by saxon-js's `SaxonJS.transform` after applying the KoSIT EN16931 / XRechnung
// CIUS SEFs — into the typed `ValidationIssue` shape consumed by
// `validator.ts` (per-layer aggregation) and the EInvoice tab UI.
//
// SVRL element semantics (per ISO/IEC 19757-3 Annex C):
//   * <svrl:failed-assert> — assertion that should hold but didn't (problem).
//   * <svrl:successful-report> — diagnostic that fired (information / hint).
//
// Severity is read from the `@flag` attribute (KoSIT-style), with these
// canonical mappings:
//   fatal       → severity 'fatal'   → errors[]
//   error       → severity 'error'   → errors[]
//   warning     → severity 'warning' → warnings[]
//   information → severity 'info'    → infos[]
//   <missing>   → severity 'error'   → errors[]   (defensive default)
//   <unknown>   → severity 'error'   → errors[]   (defensive default; logged)
//
// SECURITY: the parser is configured with `processEntities: false` and
// `allowBooleanAttributes: false` — XML external entities (XXE) and
// billion-laughs entity blow-ups are short-circuited at the SVRL parsing
// boundary. Only the SVRL XML produced by saxon-js's stylesheet engine is
// parsed here, but a second-line defence keeps us safe if that ever changes.

import { createLogger } from '@contractor-ops/logger';
import { XMLParser } from 'fast-xml-parser';

const log = createLogger({ service: 'einvoice.xrechnung-de.svrl-normalizer' });

/** Public canonical issue type — mirrors the one re-exported from validator.ts. */
export interface ValidationIssue {
  ruleId: string;
  xpath: string;
  message: string;
  severity: 'fatal' | 'error' | 'warning' | 'info';
}

export interface NormalisedSvrl {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  infos: ValidationIssue[];
}

// ---------------------------------------------------------------------------
// Parser — XXE-safe, single instance reused per process.
// ---------------------------------------------------------------------------

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: false,
  allowBooleanAttributes: false,
  processEntities: false, // XXE + billion-laughs mitigation
  // SVRL nodes can repeat; keep both as arrays even when only one is present.
  isArray: name => ['svrl:failed-assert', 'svrl:successful-report'].includes(name),
  // Strip the svrl: namespace prefix on read so callers can use stable keys.
  removeNSPrefix: false,
});

// ---------------------------------------------------------------------------
// Severity mapping
// ---------------------------------------------------------------------------

type SvrlFlag = 'fatal' | 'error' | 'warning' | 'information' | 'info';

const SEVERITY_MAP: Record<SvrlFlag, ValidationIssue['severity']> = {
  fatal: 'fatal',
  error: 'error',
  warning: 'warning',
  information: 'info',
  info: 'info',
};

const seenUnknownFlags = new Set<string>();

function mapSeverity(flag: unknown): ValidationIssue['severity'] {
  if (flag === undefined || flag === null || flag === '') return 'error';
  const key = String(flag).toLowerCase();
  if (key in SEVERITY_MAP) return SEVERITY_MAP[key as SvrlFlag];
  if (!seenUnknownFlags.has(key)) {
    seenUnknownFlags.add(key);
    log.warn({ flag: key }, 'svrl-normaliser: unknown @flag value, defaulting to "error"');
  }
  return 'error';
}

// ---------------------------------------------------------------------------
// Element → ValidationIssue
// ---------------------------------------------------------------------------

interface SvrlElement {
  '@_id'?: string;
  '@_location'?: string;
  '@_flag'?: string;
  'svrl:text'?: string | { '#text'?: string };
  // Some KoSIT variants use plain <text> (no prefix). Handle both.
  text?: string | { '#text'?: string };
}

function extractMessage(node: SvrlElement): string {
  const candidate = node['svrl:text'] ?? node.text ?? '';
  if (typeof candidate === 'string') return candidate.trim();
  if (typeof candidate === 'object' && candidate && '#text' in candidate) {
    return String(candidate['#text'] ?? '').trim();
  }
  return '';
}

function toIssue(node: SvrlElement): ValidationIssue {
  return {
    ruleId: String(node['@_id'] ?? ''),
    xpath: String(node['@_location'] ?? ''),
    message: extractMessage(node),
    severity: mapSeverity(node['@_flag']),
  };
}

function bucket(issue: ValidationIssue, out: NormalisedSvrl): void {
  switch (issue.severity) {
    case 'fatal':
    case 'error':
      out.errors.push(issue);
      break;
    case 'warning':
      out.warnings.push(issue);
      break;
    case 'info':
      out.infos.push(issue);
      break;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a saxon-js–emitted SVRL document and bucket its issues by severity.
 *
 * Tolerant of empty / namespace-less / nested SVRL trees. Never throws on
 * benign input — only on a malformed XML root (in which case we log and return
 * empty buckets so the validator pipeline can decide its short-circuit policy).
 */
export function normaliseSvrl(svrlXml: string): NormalisedSvrl {
  const out: NormalisedSvrl = { errors: [], warnings: [], infos: [] };

  if (!svrlXml || typeof svrlXml !== 'string' || svrlXml.trim() === '') {
    return out;
  }

  let parsed: unknown;
  try {
    parsed = parser.parse(svrlXml);
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'svrl-normaliser: SVRL parse failed; returning empty buckets',
    );
    return out;
  }

  if (!parsed || typeof parsed !== 'object') return out;
  // Walk the entire parse tree and gather every <svrl:failed-assert> and
  // <svrl:successful-report>. SVRL has additional layers (active-pattern,
  // fired-rule) but only those two carry the issues we surface.
  visit(parsed, out);
  return out;
}

// The two issue-bearing SVRL node keys, each in prefixed and bare form.
const ISSUE_KEYS = new Set([
  'svrl:failed-assert',
  'failed-assert',
  'svrl:successful-report',
  'successful-report',
]);

/** Bucket every `<svrl:*>` element under an issue-bearing key. */
function collectIssues(value: unknown, out: NormalisedSvrl): void {
  const list = Array.isArray(value) ? value : [value];
  for (const el of list) bucket(toIssue(el as SvrlElement), out);
}

function visit(node: unknown, out: NormalisedSvrl): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const child of node) visit(child, out);
    return;
  }
  if (typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;

  for (const [key, value] of Object.entries(obj)) {
    if (ISSUE_KEYS.has(key)) {
      collectIssues(value, out);
      continue;
    }
    if (typeof value === 'object' && value !== null) {
      visit(value, out);
    }
  }
}
