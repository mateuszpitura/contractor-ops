'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { portalTrpc } from '@/trpc/init';
import type { DateFormatKey, DateTimeFormatOpts, TimeFormatKey } from '../format-date';
import {
  formatDate as coreDateFmt,
  formatDateTime as coreDateTimeFmt,
  formatTime as coreTimeFmt,
  DEFAULT_DATE_FORMAT,
  DEFAULT_TIME_FORMAT,
} from '../format-date';

/**
 * Portal-aware date formatter.
 *
 * Reads `dateFormat`, `timeFormat`, and `timezone` from the portal session's
 * `organization` payload (exposed by `portal.getSession`).
 */
export function usePortalDateFormatter() {
  const { data: session } = useQuery(portalTrpc.portal.getSession.queryOptions());

  const opts = useMemo(() => {
    const org = session?.organization;
    return {
      dateFormat: (org?.dateFormat as DateFormatKey) ?? DEFAULT_DATE_FORMAT,
      timeFormat: (org?.timeFormat as TimeFormatKey) ?? DEFAULT_TIME_FORMAT,
      timeZone: (org?.timezone as string) ?? undefined,
    };
  }, [session]);

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
