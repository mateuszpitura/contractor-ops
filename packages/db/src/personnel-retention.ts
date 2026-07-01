/**
 * Personnel-file ("akta osobowe" / Personalakte) retention resolver.
 *
 * The flat RETENTION_YEARS map answers "how many years for this record type",
 * but a personnel file needs three things the flat map cannot express:
 *   - a per-rule event anchor (HIRE_DATE | TERMINATION_DATE | DOCUMENT_DATE)
 *   - a max() combinator (US I-9 keeps the later of hire+3y or termination+1y,
 *     8 CFR 274a.2)
 *   - indefinite retention while the employee is active — the clock only starts
 *     once its anchor event exists, so a missing anchor means "never purge"
 *
 * This resolver is the ONLY thing that adds those semantics; the years still
 * come exclusively from RETENTION_YEARS (one source of truth, no parallel
 * engine). Both deletion chokepoints (soft-delete guard, data-purge cron) call
 * it to decide whether a row is still held.
 */

import { RETENTION_YEARS } from './retention-policy.js';

/** Event a retention clock starts from. Mirrors compliance-policy's RetentionAnchor. */
export type RetentionAnchor = 'HIRE_DATE' | 'TERMINATION_DATE' | 'DOCUMENT_DATE';

/**
 * A single statutory retention window for a section. `recordType` keys the
 * shared RETENTION_YEARS map for the number of years; `years` is an optional
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

/** Adds whole years to a date, matching getRetentionCutoff's setFullYear arithmetic. */
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
