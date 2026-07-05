// Source-of-truth field partition — the crux of HRIS two-way sync.
//
// A naive two-way sync loops forever: a pull writes a field, that write
// triggers a push, the push updates the HRIS, the HRIS emits a change, the
// next pull writes it back. This engine breaks the loop STRUCTURALLY: the
// HRIS-owned set (name/contact/position/department/status/FTE/hire/termination
// + mapped custom attributes) and the Contractor-Ops-owned set
// (invoice/payment/classification/compliance + national identifiers) are
// DISJOINT. The inbound pull writes ONLY the HRIS-owned allowlist; the
// outbound push carries ONLY CO-owned business events. Because no field is
// written by both directions, a pull can never trigger a push and a push can
// never be echoed back by a pull.
//
// `HrisWritableEmployeePatch` makes "financial/compliance/national-ID fields
// are un-writable by the pull" true at the TYPE level: those keys are physically
// absent from the patch, so they can never enter the Prisma update payload the
// mapper emits. `projectToWritablePatch` additionally drops any HRIS attribute a
// (possibly hostile) mapping points at a protected key. `assertNotHrisOwnedField`
// is the change-origin guard: it fails loudly if a future push payload ever
// carries an HRIS-owned key, which would re-introduce a cycle.

import type { HrisEmployeeRecord, HrisFieldMapping, HrisPushPayload } from './types';

export type FieldOwner = 'HRIS' | 'CONTRACTOR_OPS';

/** The four employment states the HRIS may set (mirrors the Prisma EmploymentStatus enum). */
export type WritableEmploymentStatus = 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED';

/**
 * The ONLY keys the inbound pull may write. Financial/compliance/classification
 * keys and national-identifier columns (`*Encrypted`/`*Last4`, pesel/ssn/iqama/
 * emiratesId) are physically absent — they cannot enter a pull's update payload.
 * `countryFieldsPatch` is MERGED into `EmployeeProfile.countryFields` and is
 * itself filtered to HRIS-owned, non-national-ID keys by the projection below.
 */
export interface HrisWritableEmployeePatch {
  displayName?: string;
  email?: string | null;
  employmentStatus?: WritableEmploymentStatus;
  etat?: string | null;
  hireDate?: string | null;
  terminatedAt?: string | null;
  countryFieldsPatch?: Record<string, unknown>;
}

/**
 * The documented owner partition. Registry/identity fields belong to the HRIS;
 * money, compliance, classification, and national identifiers belong to
 * Contractor-Ops and are never HRIS-writable. This map is the human-readable
 * source of truth behind the type-level allowlist above.
 */
export const FIELD_OWNER: Record<string, FieldOwner> = {
  displayName: 'HRIS',
  email: 'HRIS',
  position: 'HRIS',
  department: 'HRIS',
  employmentStatus: 'HRIS',
  etat: 'HRIS',
  hireDate: 'HRIS',
  terminatedAt: 'HRIS',
  countryFieldsPatch: 'HRIS',
  // Contractor-Ops-owned — never writable by the pull.
  invoice: 'CONTRACTOR_OPS',
  payment: 'CONTRACTOR_OPS',
  classification: 'CONTRACTOR_OPS',
  compliance: 'CONTRACTOR_OPS',
  pesel: 'CONTRACTOR_OPS',
  ssn: 'CONTRACTOR_OPS',
  iqama: 'CONTRACTOR_OPS',
  emiratesId: 'CONTRACTOR_OPS',
};

/**
 * The top-level writable patch keys, used by the change-origin guard to detect
 * an HRIS-owned field appearing where it must not (a push payload).
 */
const HRIS_OWNED_KEYS: ReadonlySet<string> = new Set([
  'displayName',
  'email',
  'employmentStatus',
  'etat',
  'hireDate',
  'terminatedAt',
  'position',
  'department',
  'countryFieldsPatch',
]);

/**
 * Token denylist for `countryFieldsPatch` keys. A key whose lowercased form
 * contains any of these tokens is a protected (CO-owned / national-ID) field
 * and is DROPPED from the patch — even when a hostile mapping points an HRIS
 * attribute at it. The per-market `.strict()` countryFields schemas reject the
 * same identifiers downstream; this is defense-in-depth at the projection.
 */
const PROTECTED_KEY_TOKENS: readonly string[] = [
  'pesel',
  'ssn',
  'iqama',
  'emirates',
  'encrypted',
  'last4',
  'invoice',
  'payment',
  'classification',
  'compliance',
  'salary',
  'rate',
];

function isProtectedCountryFieldKey(key: string): boolean {
  const lowered = key.toLowerCase();
  return PROTECTED_KEY_TOKENS.some(token => lowered.includes(token));
}

/** Normalize an arbitrary provider status string to the writable enum, or drop it. */
function normalizeEmploymentStatus(raw: unknown): WritableEmploymentStatus | undefined {
  if (typeof raw !== 'string') return;
  const v = raw
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  switch (v) {
    case 'ACTIVE':
    case 'EMPLOYED':
      return 'ACTIVE';
    case 'ON_LEAVE':
    case 'LEAVE':
    case 'ONLEAVE':
      return 'ON_LEAVE';
    case 'SUSPENDED':
      return 'SUSPENDED';
    case 'TERMINATED':
    case 'INACTIVE':
    case 'OFFBOARDED':
      return 'TERMINATED';
    default:
      return;
  }
}

function asOptionalString(raw: unknown): string | undefined {
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  return;
}

/**
 * Project a raw HRIS record through the org's field mapping into the writable
 * allowlist patch. Any HRIS attribute a mapping points at a CO-owned or unknown
 * target is DROPPED (never throws — attribute-scoped providers omit fields
 * silently, so absence is normal). `countryFieldsPatch` is filtered to
 * non-protected keys; national-ID keys can never survive.
 */
export function projectToWritablePatch(
  raw: HrisEmployeeRecord,
  mapping: HrisFieldMapping,
): HrisWritableEmployeePatch {
  const attrs = raw.attributes ?? {};
  const std = mapping.standard ?? {};
  const patch: HrisWritableEmployeePatch = {};

  if (std.displayName) {
    const v = asOptionalString(attrs[std.displayName]);
    if (v !== undefined) patch.displayName = v;
  }
  if (std.email) {
    const v = asOptionalString(attrs[std.email]);
    if (v !== undefined) patch.email = v;
  }
  if (std.employmentStatus) {
    const v = normalizeEmploymentStatus(attrs[std.employmentStatus]);
    if (v !== undefined) patch.employmentStatus = v;
  }
  if (std.hireDate) {
    const v = asOptionalString(attrs[std.hireDate]);
    if (v !== undefined) patch.hireDate = v;
  }
  if (std.terminatedAt) {
    const v = asOptionalString(attrs[std.terminatedAt]);
    if (v !== undefined) patch.terminatedAt = v;
  }

  const countryFieldsPatch: Record<string, unknown> = {};
  // position/department are HRIS-owned countryFields keys.
  if (std.position && !isProtectedCountryFieldKey('position')) {
    const v = attrs[std.position];
    if (v !== undefined) countryFieldsPatch.position = v;
  }
  if (std.department && !isProtectedCountryFieldKey('department')) {
    const v = attrs[std.department];
    if (v !== undefined) countryFieldsPatch.department = v;
  }
  // Custom-attribute mapping: HRIS attr key → countryFields target key. Any
  // target key that resolves to a protected (CO-owned / national-ID) field is
  // dropped, so a hostile mapping cannot smuggle a PESEL into the patch.
  for (const [hrisAttrKey, targetKey] of Object.entries(mapping.customAttributes ?? {})) {
    if (isProtectedCountryFieldKey(targetKey)) continue;
    if (FIELD_OWNER[targetKey] === 'CONTRACTOR_OPS') continue;
    const v = attrs[hrisAttrKey];
    if (v !== undefined) countryFieldsPatch[targetKey] = v;
  }

  if (Object.keys(countryFieldsPatch).length > 0) {
    patch.countryFieldsPatch = countryFieldsPatch;
  }

  return patch;
}

/**
 * Change-origin guard. A push payload carries a CO-owned business event and
 * must NOT contain any HRIS-owned registry key — if it did, the push could
 * update a field the pull also writes, re-introducing a write-back loop. Throws
 * loudly so a future dev who widens a payload into the HRIS-owned set fails a
 * test rather than shipping a cycle.
 */
export function assertNotHrisOwnedField(payload: HrisPushPayload): void {
  for (const key of Object.keys(payload)) {
    if (HRIS_OWNED_KEYS.has(key)) {
      throw new Error(
        `HRIS push payload carries an HRIS-owned field "${key}" — this would re-introduce a write-back loop. Push payloads must carry only CO-owned business events.`,
      );
    }
  }
}
