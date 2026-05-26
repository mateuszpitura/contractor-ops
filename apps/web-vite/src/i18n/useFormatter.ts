/**
 * next-intl `useFormatter` compatibility shim for ported components.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

type DateTimeStyle = 'short' | 'medium' | 'long' | 'full';

type RelativeTimeFormatOptions = {
  now?: number | Date;
  unit?: Intl.RelativeTimeFormatUnit;
  style?: Intl.RelativeTimeFormatStyle;
  numberingSystem?: string;
};

const SECOND = 1;
const MINUTE = SECOND * 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const WEEK = DAY * 7;
const MONTH = DAY * (365 / 12);
const YEAR = DAY * 365;

const UNIT_SECONDS: Record<Intl.RelativeTimeFormatUnit, number> = {
  second: SECOND,
  seconds: SECOND,
  minute: MINUTE,
  minutes: MINUTE,
  hour: HOUR,
  hours: HOUR,
  day: DAY,
  days: DAY,
  week: WEEK,
  weeks: WEEK,
  month: MONTH,
  months: MONTH,
  quarter: MONTH * 3,
  quarters: MONTH * 3,
  year: YEAR,
  years: YEAR,
};

function resolveRelativeTimeUnit(seconds: number): Intl.RelativeTimeFormatUnit {
  const absValue = Math.abs(seconds);
  if (absValue < MINUTE) return 'second';
  if (absValue < HOUR) return 'minute';
  if (absValue < DAY) return 'hour';
  if (absValue < WEEK) return 'day';
  if (absValue < MONTH) return 'week';
  if (absValue < YEAR) return 'month';
  return 'year';
}

function formatRelativeTime(
  locale: string,
  date: Date | number,
  nowOrOptions?: number | Date | RelativeTimeFormatOptions,
): string {
  let nowDate: Date;
  let unit: Intl.RelativeTimeFormatUnit | undefined;
  const opts: Intl.RelativeTimeFormatOptions & { numberingSystem?: string } = {};

  if (nowOrOptions instanceof Date || typeof nowOrOptions === 'number') {
    nowDate = new Date(nowOrOptions);
  } else if (nowOrOptions) {
    nowDate = nowOrOptions.now == null ? new Date() : new Date(nowOrOptions.now);
    unit = nowOrOptions.unit;
    opts.style = nowOrOptions.style;
    if (nowOrOptions.numberingSystem) {
      opts.numberingSystem = nowOrOptions.numberingSystem;
    }
  } else {
    nowDate = new Date();
  }

  const dateDate = date instanceof Date ? date : new Date(date);
  const seconds = (dateDate.getTime() - nowDate.getTime()) / 1000;
  if (!unit) {
    unit = resolveRelativeTimeUnit(seconds);
  }

  opts.numeric = unit === 'second' ? 'auto' : 'always';
  const value = Math.round(seconds / UNIT_SECONDS[unit]);
  return new Intl.RelativeTimeFormat(locale, opts).format(value, unit);
}

export function useFormatter() {
  const { i18n } = useTranslation();

  return useMemo(() => {
    const locale = i18n.language ?? 'en';

    return {
      dateTime(
        value: Date | string | number,
        options?: Intl.DateTimeFormatOptions | DateTimeStyle,
      ): string {
        const date = value instanceof Date ? value : new Date(value);
        if (typeof options === 'string') {
          const styleMap: Record<DateTimeStyle, Intl.DateTimeFormatOptions> = {
            short: { dateStyle: 'short' },
            medium: { dateStyle: 'medium' },
            long: { dateStyle: 'long' },
            full: { dateStyle: 'full' },
          };
          return new Intl.DateTimeFormat(locale, styleMap[options]).format(date);
        }
        return new Intl.DateTimeFormat(locale, options).format(date);
      },
      number(value: number, options?: Intl.NumberFormatOptions): string {
        return new Intl.NumberFormat(locale, options).format(value);
      },
      relativeTime(
        date: Date | number,
        nowOrOptions?: number | Date | RelativeTimeFormatOptions,
      ): string {
        return formatRelativeTime(locale, date, nowOrOptions);
      },
    };
  }, [i18n.language]);
}
