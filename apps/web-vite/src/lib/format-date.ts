/**
 * Centralized date & time formatting. Lifted from
 * apps/web/src/lib/format-date.ts unchanged.
 */

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

export const DEFAULT_DATE_FORMAT: DateFormatKey = 'DD.MM.YYYY';
export const DEFAULT_TIME_FORMAT: TimeFormatKey = '24h';

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

function localeForDateFormat(fmt: DateFormatKey): string {
  switch (fmt) {
    case 'DD/MM/YYYY':
      return 'en-GB';
    case 'MM/DD/YYYY':
      return 'en-US';
    case 'YYYY-MM-DD':
      return 'sv-SE';
    case 'DD.MM.YYYY':
      return 'de-DE';
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

export interface DateTimeFormatOpts {
  dateFormat?: DateFormatKey;
  timeFormat?: TimeFormatKey;
  timeZone?: string;
}

export function formatDate(
  value: Date | string | null | undefined,
  opts: DateTimeFormatOpts = {},
): string {
  if (value == null) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  const fmt = opts.dateFormat ?? DEFAULT_DATE_FORMAT;
  const intlOpts: Intl.DateTimeFormatOptions = {
    ...dateOptions(fmt),
    ...(opts.timeZone ? { timeZone: opts.timeZone } : {}),
  };
  return new Intl.DateTimeFormat(localeForDateFormat(fmt), intlOpts).format(d);
}

export function formatTime(
  value: Date | string | null | undefined,
  opts: DateTimeFormatOpts = {},
): string {
  if (value == null) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
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

export function formatDateTime(
  value: Date | string | null | undefined,
  opts: DateTimeFormatOpts = {},
): string {
  if (value == null) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  const dateFmt = opts.dateFormat ?? DEFAULT_DATE_FORMAT;
  const timeFmt = opts.timeFormat ?? DEFAULT_TIME_FORMAT;
  const intlOpts: Intl.DateTimeFormatOptions = {
    ...dateOptions(dateFmt),
    ...timeOptions(timeFmt),
    ...(opts.timeZone ? { timeZone: opts.timeZone } : {}),
  };
  return new Intl.DateTimeFormat(localeForDateFormat(dateFmt), intlOpts).format(d);
}

export function previewDateFormat(fmt: DateFormatKey): string {
  const sample = new Date(2026, 2, 7, 14, 30);
  return formatDate(sample, { dateFormat: fmt });
}

export function previewTimeFormat(fmt: TimeFormatKey): string {
  const sample = new Date(2026, 2, 7, 14, 30);
  return formatTime(sample, { timeFormat: fmt });
}
