// Phase 71 D-07 — TZ-aware expiry boundary helper.
//
// "Expires today" boundary resolves at 00:00 in `expiryJurisdictionTz`, NOT in
// the org HQ TZ. Set at row-creation from the engagement's jurisdiction; never
// retroactively rewritten.
//
// ROADMAP success criterion #2: a Riyadh contractor's "expires today" must
// resolve at 00:00 Asia/Riyadh, regardless of where the org's HQ is.

import { TZDate } from '@date-fns/tz';
import { differenceInDays, isAfter, startOfDay } from 'date-fns';

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
