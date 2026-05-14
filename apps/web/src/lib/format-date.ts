/**
 * Centralized date & time formatting utility.
 *
 * Organisation-level preferences (`dateFormat` / `timeFormat`) control how
 * every date surface in the app renders.  The helpers below translate those
 * preference keys into `Intl.DateTimeFormat` options so we get locale-correct
 * output while honouring the user's chosen shape.
 */

// ---------------------------------------------------------------------------
// Format enums (must stay in sync with @contractor-ops/validators)
// ---------------------------------------------------------------------------

export const DATE_FORMATS = [
  'DD/MM/YYYY',
  'MM/DD/YYYY',
  'YYYY-MM-DD',
  'DD.MM.YYYY',
  'DD MMM YYYY',
] as const;

export type DateFormatKey = (typeof DATE_FORMATS)[number];

export const TIME_FORMATS = ['24h', '12h'] as const;

export type TimeFormatKey = (typeof TIME_FORMATS)[number];

/** Sensible defaults when no org settings are available yet. */
export const DEFAULT_DATE_FORMAT: DateFormatKey = 'DD.MM.YYYY';
export const DEFAULT_TIME_FORMAT: TimeFormatKey = '24h';

// ---------------------------------------------------------------------------
// Intl option builders
// ---------------------------------------------------------------------------

/** Map a `DateFormatKey` to `Intl.DateTimeFormatOptions`. */
function dateOptions(fmt: DateFormatKey): Intl.DateTimeFormatOptions {
  switch (fmt) {
    case 'DD/MM/YYYY':
    case 'MM/DD/YYYY':
    case 'DD.MM.YYYY':
      return { day: '2-digit', month: '2-digit', year: 'numeric' };
    case 'YYYY-MM-DD':
      return { day: '2-digit', month: '2-digit', year: 'numeric' };
    case 'DD MMM YYYY':
      return { day: 'numeric', month: 'short', year: 'numeric' };
  }
}

/**
 * BCP 47 locale tag that forces `Intl.DateTimeFormat` to emit the
 * component order matching the chosen format key.
 *
 * We intentionally override the user's UI locale here because the org
 * picked a *specific* date shape — 'DD.MM.YYYY' should always render
 * day-first regardless of browser locale.
 */
function localeForDateFormat(fmt: DateFormatKey): string {
  switch (fmt) {
    case 'DD/MM/YYYY':
      return 'en-GB';
    case 'MM/DD/YYYY':
      return 'en-US';
    case 'YYYY-MM-DD':
      return 'sv-SE'; // ISO-style ordering
    case 'DD.MM.YYYY':
      return 'de-DE'; // dot-separated, day first
    case 'DD MMM YYYY':
      return 'en-GB';
  }
}

function timeOptions(fmt: TimeFormatKey): Intl.DateTimeFormatOptions {
  return {
    hour: '2-digit',
    minute: '2-digit',
    hour12: fmt === '12h',
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface DateTimeFormatOpts {
  dateFormat?: DateFormatKey;
  timeFormat?: TimeFormatKey;
  /** IANA timezone — falls back to browser default when omitted. */
  timeZone?: string;
}

/** Format a date value (no time component). */
export function formatDate(
  value: Date | string | null | undefined,
  opts: DateTimeFormatOpts = {},
): string {
  if (value == null) return '\u2014';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '\u2014';

  const fmt = opts.dateFormat ?? DEFAULT_DATE_FORMAT;
  const intlOpts: Intl.DateTimeFormatOptions = {
    ...dateOptions(fmt),
    ...(opts.timeZone ? { timeZone: opts.timeZone } : {}),
  };

  return new Intl.DateTimeFormat(localeForDateFormat(fmt), intlOpts).format(d);
}

/** Format a time value (no date component). */
export function formatTime(
  value: Date | string | null | undefined,
  opts: DateTimeFormatOpts = {},
): string {
  if (value == null) return '\u2014';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '\u2014';

  const fmt = opts.timeFormat ?? DEFAULT_TIME_FORMAT;
  const intlOpts: Intl.DateTimeFormatOptions = {
    ...timeOptions(fmt),
    ...(opts.timeZone ? { timeZone: opts.timeZone } : {}),
  };

  return new Intl.DateTimeFormat(
    localeForDateFormat(opts.dateFormat ?? DEFAULT_DATE_FORMAT),
    intlOpts,
  ).format(d);
}

/** Format a full date+time value. */
export function formatDateTime(
  value: Date | string | null | undefined,
  opts: DateTimeFormatOpts = {},
): string {
  if (value == null) return '\u2014';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '\u2014';

  const dateFmt = opts.dateFormat ?? DEFAULT_DATE_FORMAT;
  const timeFmt = opts.timeFormat ?? DEFAULT_TIME_FORMAT;
  const intlOpts: Intl.DateTimeFormatOptions = {
    ...dateOptions(dateFmt),
    ...timeOptions(timeFmt),
    ...(opts.timeZone ? { timeZone: opts.timeZone } : {}),
  };

  return new Intl.DateTimeFormat(localeForDateFormat(dateFmt), intlOpts).format(d);
}

/**
 * Generate a human-readable preview of a format (used in the settings form).
 * Always uses a fixed reference date so the user can compare shapes.
 */
export function previewDateFormat(fmt: DateFormatKey): string {
  // 2026-03-07 14:30 — a date where day/month are unambiguous
  const sample = new Date(2026, 2, 7, 14, 30);
  return formatDate(sample, { dateFormat: fmt });
}

export function previewTimeFormat(fmt: TimeFormatKey): string {
  const sample = new Date(2026, 2, 7, 14, 30);
  return formatTime(sample, { timeFormat: fmt });
}
