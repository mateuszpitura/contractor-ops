// Phase 71 D-07 — TZ-aware expiry boundary helper.
//
// "Expires today" boundary resolves at 00:00 in `expiryJurisdictionTz`, NOT in
// the org HQ TZ. Set at row-creation from the engagement's jurisdiction; never
// retroactively rewritten.
//
// ROADMAP success criterion #2: a Riyadh contractor's "expires today" must
// resolve at 00:00 Asia/Riyadh, regardless of where the org's HQ is.

import { TZDate } from '@date-fns/tz';
import { addDays, addMonths, addYears, differenceInDays, isAfter, startOfDay } from 'date-fns';
import type { PolicyRule } from './types.js';

/**
 * Returns true iff `expiresAt` (a calendar date stored as `@db.Date`) has
 * already passed in `expiryJurisdictionTz` as of `now`.
 *
 * Boundary semantics: the row is considered EXPIRED when the start-of-day in
 * the contractor's TZ is strictly AFTER the start-of-day of `expiresAt` in
 * the same TZ. So `expiresAt = today` is NOT expired until `now` rolls over
 * to `tomorrow 00:00` in the contractor's TZ.
 *
 * @param expiresAt    Calendar date stored as `@db.Date` (no time component).
 * @param expiryJurisdictionTz IANA TZ string (e.g., 'Asia/Riyadh').
 * @param now          Current time (pure-function-friendly default = new Date()).
 */
export function isExpired(
  expiresAt: Date,
  expiryJurisdictionTz: string,
  now: Date = new Date(),
): boolean {
  const startOfToday = startOfDay(new TZDate(now, expiryJurisdictionTz));
  const expiryBoundary = startOfDay(new TZDate(expiresAt, expiryJurisdictionTz));
  return isAfter(startOfToday, expiryBoundary);
}

/**
 * Phase 72 D-07 — integer days from `now` (in TZ) to `expiresAt` (in TZ),
 * comparing start-of-day boundaries in `expiryJurisdictionTz`. Negative when
 * already expired. Used by the COMPL-03 reminder-band classifier.
 */
export function daysUntilExpiryInTz(
  expiresAt: Date,
  expiryJurisdictionTz: string,
  now: Date = new Date(),
): number {
  const nowInTz = startOfDay(new TZDate(now, expiryJurisdictionTz));
  const expiryInTz = startOfDay(new TZDate(expiresAt, expiryJurisdictionTz));
  return differenceInDays(expiryInTz, nowInTz);
}

/**
 * Phase 72 — YYYY-MM-DD in `tz` for `now`. Used as the per-band fire dedup-key
 * date component and the per-recipient digest dedup-key date component.
 */
export function jurisdictionDate(now: Date, tz: string): string {
  return startOfDay(new TZDate(now, tz)).toISOString().slice(0, 10);
}

/**
 * Phase 73 D-07 — auto-derive the default `expiresAt` for a contractor-uploaded
 * document from the rule's expiry semantic. Used by the portal upload form
 * (auto-fill the expiresAt input) and the admin review modal (default on approve).
 *
 * Examples:
 *   uk.right_to_work@v1 → expirySemantic='fixed_days', expiryDays=90 → +90d
 *   de.a1@v1            → expirySemantic='fixed_months', expiryMonths=24 → +24mo
 *   uk.utr@v1           → expirySemantic='no_expiry' → sentinel +100y
 *
 * Throws on rules without `expirySemantic` set — the registry populates it for
 * every rule (asserted by the expiry-semantic-coverage test).
 */
export function defaultExpiryFromUploadDate(rule: PolicyRule, uploadDate: Date = new Date()): Date {
  switch (rule.expirySemantic) {
    case 'fixed_days':
      if (typeof rule.expiryDays !== 'number') {
        throw new Error(`Rule ${rule.policyRuleId} has fixed_days but no expiryDays`);
      }
      return addDays(uploadDate, rule.expiryDays);
    case 'fixed_months':
      if (typeof rule.expiryMonths !== 'number') {
        throw new Error(`Rule ${rule.policyRuleId} has fixed_months but no expiryMonths`);
      }
      return addMonths(uploadDate, rule.expiryMonths);
    case 'no_expiry':
      // Sentinel — UI may display "no expiry" instead of the literal year.
      return addYears(uploadDate, 100);
    default:
      throw new Error(
        `Rule ${rule.policyRuleId} has unknown or missing expirySemantic: ${rule.expirySemantic ?? 'undefined'}`,
      );
  }
}
