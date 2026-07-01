/**
 * Statutory record-retention windows.
 *
 * Keyed by a stable record-type token so US tax models and per-jurisdiction
 * personnel-file rules register on the SAME map — no parallel retention
 * engines. Years (not days), because every statutory window is expressed in
 * years; the deletion chokepoints convert to a cutoff date.
 *
 * Legal note: the 4-yr 1099-NEC / 7-yr backup-withholding values are IRS
 * figures and need jurisdiction-specific legal/tax-adviser verification before
 * production deploy (Standing Project Constraint; LOCAL-ONLY).
 */
export const RETENTION_YEARS = {
  '1099-NEC': 4,
  'backup-withholding': 7,
  // Personnel-file ("akta osobowe" / Personalakte) windows, keyed by the same
  // recordType tokens the per-jurisdiction section registry names. Seeded
  // reference data pending legal/tax-adviser verification (LOCAL-ONLY).
  'pl-akta-post2019': 10,
  'pl-akta-legacy': 50,
  'de-personalakte-tax': 10,
  'de-accident-records': 30,
  'uk-personnel-general': 6,
  'uk-personnel-financial': 7,
  'us-i9-post-hire': 3,
  'us-i9-post-termination': 1,
} as const;

export type RetainedRecordType = keyof typeof RETENTION_YEARS;

/**
 * Maps a soft-delete Prisma MODEL name → its retention record type.
 *
 * Form1099Nec carries the statutory 4-year IRS retention; it also joins
 * `softDeleteModels` so the deletion chokepoints convert a hard delete to a
 * soft delete and refuse to purge a row still inside its retention window.
 */
export const MODEL_RETENTION_TYPE: Partial<Record<string, RetainedRecordType>> = {
  Form1099Nec: '1099-NEC',
};

/** Statutory retention period, in years, for a known record type. */
export function resolveRetentionYears(recordType: RetainedRecordType): number {
  return RETENTION_YEARS[recordType];
}

/**
 * Returns the purge cutoff for a model (the oldest `deletedAt` that may still
 * be permanently destroyed), or `null` when the model has no retention rule.
 *
 * A row whose `deletedAt` is OLDER than the returned cutoff is past its
 * statutory window and may be purged; a row inside the window must be retained.
 *
 * `overrideMap` lets tests inject a fixture mapping (e.g. `Invoice → '1099-NEC'`)
 * while the production `MODEL_RETENTION_TYPE` stays empty.
 */
export function getRetentionCutoff(
  model: string,
  now: Date,
  overrideMap: Partial<Record<string, RetainedRecordType>> = MODEL_RETENTION_TYPE,
): Date | null {
  const recordType = overrideMap[model];
  if (!recordType) return null;
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - RETENTION_YEARS[recordType]);
  return cutoff;
}

// The event-anchored personnel-file resolver lives in its own module but reads
// years from RETENTION_YEARS above (one source of truth). Re-exported here so
// every retention consumer imports the whole primitive from one place.
export {
  getPersonnelRetentionCutoff,
  type PersonnelRetentionDates,
  type PersonnelRetentionResult,
  type PersonnelRetentionRuleInput,
  type RetentionAnchor,
} from './personnel-retention.js';
