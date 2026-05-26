import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { DateFormatKey, DateTimeFormatOpts, TimeFormatKey } from '../lib/format-date.js';
import {
  formatDate as coreDateFmt,
  formatDateTime as coreDateTimeFmt,
  formatTime as coreTimeFmt,
  DEFAULT_DATE_FORMAT,
  DEFAULT_TIME_FORMAT,
} from '../lib/format-date.js';
import { useTRPC } from '../providers/trpc-provider.js';

interface OrgDateTimeOpts {
  dateFormat: DateFormatKey;
  timeFormat: TimeFormatKey;
  timeZone?: string;
}

/** Date/time formatters pre-configured with org settings from tRPC. */
export function useDateFormatter() {
  const trpc = useTRPC();
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
