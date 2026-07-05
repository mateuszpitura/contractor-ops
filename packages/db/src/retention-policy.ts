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
  // PL KP art. 149 working-time register. 3 years is the DB-immutability floor
  // (roszczenia ze stosunku pracy przedawniają się z upływem 3 lat, KP art. 291
  // §1). The dokumentacja pracownicza itself is retained 10 years (KP §94⁴) —
  // satisfied here by NON-DELETION: EwidencjaSnapshot is append-only, carries no
  // deletedAt, and joins no soft-delete purge cascade, so nothing ever deletes
  // it. Values pending legal/tax-adviser verification (LOCAL-ONLY).
  'KP-ewidencja': 3,
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
  // Documents the KP §149 register's statutory window. EwidencjaSnapshot is NOT
  // a soft-delete model, so getRetentionCutoff is never invoked for it by the
  // purge cron (which iterates softDeleteModels) — the mapping records the
  // window without wiring any deletion path.
  EwidencjaSnapshot: 'KP-ewidencja',
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

// ---------------------------------------------------------------------------
// Personnel-file ("akta osobowe" / Personalakte) event-anchored resolver.
// ---------------------------------------------------------------------------
//
// The flat map above answers "how many years for this record type", but a
// personnel file needs three things the flat map cannot express:
//   - a per-rule event anchor (HIRE_DATE | TERMINATION_DATE | DOCUMENT_DATE)
//   - a max() combinator (US I-9 keeps the later of hire+3y or termination+1y,
//     8 CFR 274a.2)
//   - indefinite retention while the employee is active — the clock only starts
//     once its anchor event exists, so a missing anchor means "never purge"
//
// It lives here, on the shared primitive, rather than in a parallel module: the
// years still come exclusively from RETENTION_YEARS (one source of truth), and
// both deletion chokepoints (soft-delete guard, data-purge cron) call it.

/** Event a retention clock starts from. Mirrors compliance-policy's RetentionAnchor. */
export type RetentionAnchor = 'HIRE_DATE' | 'TERMINATION_DATE' | 'DOCUMENT_DATE';

/**
 * A single statutory retention window for a section. `recordType` keys the
 * RETENTION_YEARS map above for the number of years; `years` is an optional
 * override used only by unit fixtures whose token is not registered on the map.
 * Production rules (from compliance-policy) never carry `years`, so the map is
 * always the source.
 */
export interface PersonnelRetentionRuleInput {
  recordType: string;
  anchor: RetentionAnchor;
  citation: string;
  years?: number;
}

/** The event dates a resolver needs, plus the reference "now". */
export interface PersonnelRetentionDates {
  hireDate: Date | null;
  terminationDate: Date | null;
  documentDate: Date | null;
  now: Date;
}

export interface PersonnelRetentionResult {
  /** True only when a finite window exists and now has reached it. */
  erasable: boolean;
  /** The latest binding cutoff across all rules; null = retain indefinitely. */
  retainUntil: Date | null;
  /** Statutory citation of the binding (or first indefinite) rule. */
  citation: string | null;
}

function addYears(date: Date, years: number): Date {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

function anchorDateFor(anchor: RetentionAnchor, dates: PersonnelRetentionDates): Date | null {
  switch (anchor) {
    case 'HIRE_DATE':
      return dates.hireDate;
    case 'TERMINATION_DATE':
      return dates.terminationDate;
    case 'DOCUMENT_DATE':
      return dates.documentDate;
    default:
      return null;
  }
}

function yearsFor(rule: PersonnelRetentionRuleInput): number | undefined {
  const mapped = (RETENTION_YEARS as Readonly<Record<string, number | undefined>>)[rule.recordType];
  return mapped ?? rule.years;
}

/**
 * Resolves the retention disposition for a set of personnel-file rules against a
 * row's event dates.
 *
 * Combination rules:
 *   - If ANY rule's required anchor is absent (e.g. an active employee has no
 *     termination date), the whole set is indefinite — retainUntil null, never
 *     erasable. This is fail-closed: a missing anchor holds the file.
 *   - Otherwise the binding cutoff is the LATEST rule cutoff (max()), so US I-9
 *     keeps max(hire+3y, termination+1y).
 *   - An empty rule set means no statutory hold applies, so the row is erasable.
 *     Personnel callers always pass a section's rules; this branch only fires
 *     for sections that carry no window (e.g. US general employment records).
 */
export function getPersonnelRetentionCutoff(
  rules: PersonnelRetentionRuleInput[],
  dates: PersonnelRetentionDates,
): PersonnelRetentionResult {
  if (rules.length === 0) {
    return { erasable: true, retainUntil: null, citation: null };
  }

  let binding: { retainUntil: Date; citation: string } | null = null;

  for (const rule of rules) {
    const anchorDate = anchorDateFor(rule.anchor, dates);
    if (anchorDate === null) {
      return { erasable: false, retainUntil: null, citation: rule.citation };
    }

    const years = yearsFor(rule);
    if (years === undefined) {
      // No registered window and no fixture override — retain rather than risk
      // an erroneous purge of a statutorily held file.
      return { erasable: false, retainUntil: null, citation: rule.citation };
    }

    const ruleRetainUntil = addYears(anchorDate, years);
    if (binding === null || ruleRetainUntil.getTime() > binding.retainUntil.getTime()) {
      binding = { retainUntil: ruleRetainUntil, citation: rule.citation };
    }
  }

  if (binding === null) {
    // Unreachable — rules is non-empty and every rule either sets `binding` or
    // returns early. Fail-closed (retain) if the invariant is ever violated.
    return { erasable: false, retainUntil: null, citation: null };
  }

  const { retainUntil, citation } = binding;
  return { erasable: dates.now.getTime() >= retainUntil.getTime(), retainUntil, citation };
}
