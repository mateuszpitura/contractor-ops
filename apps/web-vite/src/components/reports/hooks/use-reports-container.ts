import { startOfMonth, subMonths } from 'date-fns';
import { parseAsString, useQueryState } from 'nuqs';
import { useCallback, useMemo } from 'react';

import { usePermissions } from '../../../hooks/use-permissions.js';
import { useLocale } from '../../../i18n/navigation.js';

function getDefaultDateRange(): { from: string; to: string } {
  const now = new Date();
  return {
    from: subMonths(startOfMonth(now), 3).toISOString(),
    to: now.toISOString(),
  };
}

export function useReportsContainer() {
  const locale = useLocale();
  const { can } = usePermissions();
  const defaults = useMemo(() => getDefaultDateRange(), []);

  const [report, setReport] = useQueryState(
    'report',
    parseAsString.withDefault('spend-contractor'),
  );

  const [dateFrom, setDateFrom] = useQueryState(
    'dateFrom',
    parseAsString.withDefault(defaults.from),
  );

  const [dateTo, setDateTo] = useQueryState('dateTo', parseAsString.withDefault(defaults.to));

  const canReadReports = can('report', ['read']);

  const handleDateChange = useCallback(
    (from: string, to: string) => {
      void setDateFrom(from);
      void setDateTo(to);
    },
    [setDateFrom, setDateTo],
  );

  const handleReportChange = useCallback(
    (next: string) => {
      void setReport(next);
    },
    [setReport],
  );

  return {
    locale,
    canReadReports,
    report,
    dateFrom,
    dateTo,
    handleDateChange,
    handleReportChange,
  } as const;
}
