/**
 * Outbound-payload PII redactor (INTEG-WEBHOOK-07) — RODO-defensible by default.
 *
 * `include_pii:false` (the per-subscription default) strips national identifiers,
 * bank identifiers and contact PII from the event payload BEFORE the fan-out
 * handler snapshots it into the deliverable / DLQ row, so no PII ever persists in
 * a row an operator (or a DLQ inspection) could read. `include_pii:true` retains
 * them. Pure + synchronous; never mutates the input.
 *
 * The key-set is anchored to the real field inventory rather than a blind guess:
 *   - RBAC-gated identifiers reflected from `employeeCountryFieldsSchemaMap`
 *     (`packages/validators/src/employee-country-fields.ts`) so a rename there
 *     surfaces — steuerIdNr, svNummer, niNumber, gosiNumber, …
 *   - National-person identifiers that live in dedicated ENCRYPTED columns and
 *     so are absent from any schema: pesel (PL), ssn (us-validators), iqama
 *     (legal/compliance-ksa), emiratesId (legal/compliance-uae), nationalId.
 *   - Bank + contact PII: iban, bankAccount, accountNumber, email, phone, dob.
 */

import { employeeCountryFieldsSchemaMap } from '@contractor-ops/validators';

const REDACTION_SENTINEL = '[redacted]';

/** National-person + bank + contact identifiers (lowercased). */
const CURATED_PII_KEYS = [
  'pesel',
  'ssn',
  'socialsecuritynumber',
  'ninumber',
  'nationalinsurancenumber',
  'steueridnr',
  'steuerid',
  'svnummer',
  'taxid',
  'tin',
  'iqama',
  'emiratesid',
  'gosinumber',
  'nationalid',
  'passport',
  'passportnumber',
  'dateofbirth',
  'dob',
  'iban',
  'bankaccount',
  'accountnumber',
  'sortcode',
  'email',
  'phone',
  'phonenumber',
];

/** Suffix/variant patterns so `*IdNr` / `*ssn` / `*iqama` spellings are caught. */
const PII_KEY_PATTERNS = [/idnr$/, /(^|_)ssn(_|$)/, /iqama/, /pesel/, /emirates/, /passport/];

interface ShapeLike {
  shape?: Record<string, unknown>;
  _def?: { schema?: unknown; innerType?: unknown; type?: unknown };
}

/** Best-effort reflection of a Zod object's keys through refine/optional wrappers. */
function unwrapShapeKeys(schema: unknown): string[] {
  let current = schema as ShapeLike | undefined;
  for (let depth = 0; depth < 6 && current; depth += 1) {
    if (current.shape && typeof current.shape === 'object') {
      return Object.keys(current.shape);
    }
    const def = current._def;
    if (!def) break;
    current = (def.schema ?? def.innerType ?? def.type) as ShapeLike | undefined;
  }
  return [];
}

function buildPiiKeySet(): Set<string> {
  const keys = new Set<string>(CURATED_PII_KEYS);
  // Union the RBAC-gated identifier keys the employee schemas actually declare,
  // filtered to the identifier-shaped ones, so a rename there is auto-picked-up.
  for (const schema of Object.values(employeeCountryFieldsSchemaMap)) {
    for (const key of unwrapShapeKeys(schema)) {
      const lowered = key.toLowerCase();
      if (/(idnr|nummer|ssn|iqama|nationalid|taxid|tin|gosi)/.test(lowered)) {
        keys.add(lowered);
      }
    }
  }
  return keys;
}

/** The derived PII key-set (lowercased). Exported for the OWASP-gate assertions. */
export const WEBHOOK_PII_KEYS: ReadonlySet<string> = buildPiiKeySet();

function isPiiKey(key: string): boolean {
  const lowered = key.toLowerCase();
  if (WEBHOOK_PII_KEYS.has(lowered)) return true;
  return PII_KEY_PATTERNS.some(pattern => pattern.test(lowered));
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isPiiKey(key) ? REDACTION_SENTINEL : redactValue(inner);
    }
    return out;
  }
  return value;
}

export interface RedactOptions {
  includePii: boolean;
}

/**
 * Return a deep CLONE of `payload` with PII keys replaced by a sentinel when
 * `includePii` is false. Never mutates the input; when `includePii` is true the
 * clone is structurally identical.
 */
export function redactPii<T>(payload: T, opts: RedactOptions): T {
  if (opts.includePii) {
    return structuredClone(payload);
  }
  return redactValue(payload) as T;
}
