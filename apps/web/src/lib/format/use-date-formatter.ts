'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { trpc } from '@/trpc/init';
import type { DateFormatKey, DateTimeFormatOpts, TimeFormatKey } from '../format-date';
import {
  formatDate as coreDateFmt,
  formatDateTime as coreDateTimeFmt,
  formatTime as coreTimeFmt,
  DEFAULT_DATE_FORMAT,
  DEFAULT_TIME_FORMAT,
} from '../format-date';

interface OrgDateTimeOpts {
  dateFormat: DateFormatKey;
  timeFormat: TimeFormatKey;
  timeZone?: string;
}

/**
 * Hook that provides date/time formatters pre-configured with the
 * organisation's `dateFormat`, `timeFormat`, and `timezone` settings.
 *
 * Usage:
 * ```ts
 * const { formatDate, formatDateTime, formatTime } = useDateFormatter();
 * <span>{formatDate(invoice.issuedAt)}</span>
 * ```
 */
export function useDateFormatter() {
  const { data: settings } = useQuery(trpc.settings.get.queryOptions());

  const opts = useMemo<OrgDateTimeOpts>(() => {
    const metadata = (settings?.metadata ?? {}) as Record<string, unknown>;
    return {
      dateFormat: (metadata.dateFormat as DateFormatKey) ?? DEFAULT_DATE_FORMAT,
      timeFormat: (metadata.timeFormat as TimeFormatKey) ?? DEFAULT_TIME_FORMAT,
      timeZone: (metadata.timezone as string) ?? undefined,
    };
  }, [settings]);

  const formatDate = useCallback(
    (value: Date | string | null | undefined, overrides?: Partial<DateTimeFormatOpts>) =>
      coreDateFmt(value, { ...opts, ...overrides }),
    [opts],
  );

  const formatTime = useCallback(
    (value: Date | string | null | undefined, overrides?: Partial<DateTimeFormatOpts>) =>
      coreTimeFmt(value, { ...opts, ...overrides }),
    [opts],
  );

  const formatDateTime = useCallback(
    (value: Date | string | null | undefined, overrides?: Partial<DateTimeFormatOpts>) =>
      coreDateTimeFmt(value, { ...opts, ...overrides }),
    [opts],
  );

  return { formatDate, formatTime, formatDateTime, ...opts };
}
