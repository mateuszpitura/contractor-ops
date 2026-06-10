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
  // US tax models and per-jurisdiction personnel-file rules register
  // additional record types here.
} as const;

export type RetainedRecordType = keyof typeof RETENTION_YEARS;

/**
 * Maps a soft-delete Prisma MODEL name → its retention record type.
 *
 * Ships EMPTY (no tax tables registered yet), so production behaviour at all
 * three deletion chokepoints is identical to today. When tax models are added
 * (e.g. `Form1099Nec: '1099-NEC'`) they also join `softDeleteModels`; tests
 * inject a fixture entry to prove the wiring without shipping a production map
 * entry.
 */
export const MODEL_RETENTION_TYPE: Partial<Record<string, RetainedRecordType>> = {};

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
