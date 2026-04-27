// Phase 71 D-07 — TZ-aware expiry boundary helper.
//
// "Expires today" boundary resolves at 00:00 in `expiryJurisdictionTz`, NOT in
// the org HQ TZ. Set at row-creation from the engagement's jurisdiction; never
// retroactively rewritten.
//
// ROADMAP success criterion #2: a Riyadh contractor's "expires today" must
// resolve at 00:00 Asia/Riyadh, regardless of where the org's HQ is.

import { TZDate } from '@date-fns/tz';
import { isAfter, startOfDay } from 'date-fns';

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
