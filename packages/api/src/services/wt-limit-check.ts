// Synchronous per-jurisdiction working-time check — the on-save half of the WT
// alerting. A pure function (no DB): it resolves the jurisdiction's limit rule
// and flags a daily-ceiling / current-week heuristic breach immediately at
// time-entry save. The TRUE rolling weekly average is the daily scan's job
// (wt-limit-scan); this is the fast feedback the entry form shows inline. The UK
// weekly breach is suppressed when the worker holds a written opt-out.
//
// Findings carry a dotted i18n copy-key, never a rendered string — the UI
// resolves them per locale.

import type { Jurisdiction } from '@contractor-ops/compliance-policy';
import { resolveWtLimits } from '@contractor-ops/compliance-policy';

export type WtFindingLevel = 'approaching' | 'breach';
export type WtFindingDimension = 'daily' | 'weekly' | 'night';

export interface WtFinding {
  level: WtFindingLevel;
  dimension: WtFindingDimension;
  limit: number;
  actual: number;
  copyKey: string;
}

export interface WtCheckRecord {
  workedMinutes: number;
  nightMinutes?: number;
  /** UK written opt-out from the weekly cap (stored on the record). */
  wtOptOut?: boolean;
}

export interface WtCheckInput {
  jurisdiction: Jurisdiction;
  record: WtCheckRecord;
  /** Sum of workedMinutes across the current week including this record. */
  recentWeekMinutes: number;
}

const COPY_NS = 'EmployeeTime.wtLimit';

/**
 * Returns the working-time findings for a single saved record. Empty when the
 * jurisdiction has no registered rule (unknown market) or nothing breaches.
 */
export function checkWtLimits(input: WtCheckInput): WtFinding[] {
  const rule = resolveWtLimits(input.jurisdiction);
  if (!rule) return [];

  const findings: WtFinding[] = [];
  const worked = input.record.workedMinutes;

  // Daily: a hard ceiling (DE 10h) is the breach line; over the norm but under
  // the ceiling is an "approaching" nudge. Where no ceiling exists (PL), the
  // statutory daily norm itself is the breach line.
  if (rule.maxDailyHardCeilingMinutes !== null) {
    if (worked > rule.maxDailyHardCeilingMinutes) {
      findings.push({
        level: 'breach',
        dimension: 'daily',
        limit: rule.maxDailyHardCeilingMinutes,
        actual: worked,
        copyKey: `${COPY_NS}.daily.breach`,
      });
    } else if (rule.maxDailyMinutes !== null && worked > rule.maxDailyMinutes) {
      findings.push({
        level: 'approaching',
        dimension: 'daily',
        limit: rule.maxDailyMinutes,
        actual: worked,
        copyKey: `${COPY_NS}.daily.approaching`,
      });
    }
  } else if (rule.maxDailyMinutes !== null && worked > rule.maxDailyMinutes) {
    findings.push({
      level: 'breach',
      dimension: 'daily',
      limit: rule.maxDailyMinutes,
      actual: worked,
      copyKey: `${COPY_NS}.daily.breach`,
    });
  }

  // Weekly: current-week heuristic vs the average cap. Suppressed only where the
  // market permits an individual opt-out AND the worker has opted out (UK WTR).
  const optedOut = Boolean(input.record.wtOptOut) && rule.weeklyOptOutAllowed;
  if (!optedOut && input.recentWeekMinutes > rule.weeklyAvgMaxMinutes) {
    findings.push({
      level: 'breach',
      dimension: 'weekly',
      limit: rule.weeklyAvgMaxMinutes,
      actual: input.recentWeekMinutes,
      copyKey: `${COPY_NS}.weekly.breach`,
    });
  }

  return findings;
}
