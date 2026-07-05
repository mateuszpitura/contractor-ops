import { useQuery } from '@tanstack/react-query';
import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns';
import { parseAsString, useQueryState } from 'nuqs';
import { useCallback, useMemo } from 'react';

import { useTRPC } from '../../../providers/trpc-provider.js';

export type CalendarViewMode = 'month' | 'quarter';

export interface CalendarDayRequest {
  id: string;
  workerName?: string;
  status?: string;
}

export interface CalendarDay {
  date: string;
  teamId?: string | null;
  teamName?: string | null;
  headcount?: number;
  outCount: number;
  capacityPct: number;
  conflict: boolean;
  holiday?: { name: string } | null;
  requests: CalendarDayRequest[];
}

/**
 * The calendar payload reports a per-team-per-day out-count and a conflict flag,
 * not a team headcount — so capacity is a three-tier signal (nobody out /
 * someone out / conflict) rendered as available → busy → over, never a spurious
 * precise percentage.
 */
export function capacityTierPct(outCount: number, conflict: boolean): number {
  if (conflict) return 100;
  return outCount > 0 ? 50 : 0;
}

function isoDay(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function useTeamCalendar() {
  const trpc = useTRPC();

  const [viewModeRaw, setViewMode] = useQueryState('view', parseAsString.withDefault('month'));
  const viewMode: CalendarViewMode = viewModeRaw === 'quarter' ? 'quarter' : 'month';
  const [anchor, setAnchor] = useQueryState(
    'from',
    parseAsString.withDefault(isoDay(startOfMonth(new Date()))),
  );
  const [teamId, setTeamId] = useQueryState('team', parseAsString.withDefault('all'));

  const anchorDate = useMemo(() => startOfMonth(new Date(anchor)), [anchor]);
  const monthCount = viewMode === 'quarter' ? 3 : 1;

  const from = isoDay(anchorDate);
  const to = isoDay(endOfMonth(addMonths(anchorDate, monthCount - 1)));

  const calendarQuery = useQuery(
    trpc.leave.listTeamCalendar.queryOptions({
      from,
      to,
      ...(teamId === 'all' ? {} : { teamId }),
    }),
  );

  const holidayByDate = useMemo(() => {
    const map = new Map<string, string>();
    for (const holiday of calendarQuery.data?.holidays ?? []) map.set(holiday.date, holiday.name);
    return map;
  }, [calendarQuery.data]);

  const teamOptions = useMemo(() => {
    const options: { id: string; name: string | null }[] = [];
    for (const team of calendarQuery.data?.teams ?? []) {
      if (team.teamId) options.push({ id: team.teamId, name: team.teamName });
    }
    return options;
  }, [calendarQuery.data]);

  const days = useMemo<CalendarDay[]>(() => {
    const teams = calendarQuery.data?.teams ?? [];
    const perDate = new Map<string, CalendarDay>();

    for (const team of teams) {
      for (const day of team.days) {
        const existing = perDate.get(day.date);
        const outCount = day.count;
        const conflict = day.conflict;
        const requests: CalendarDayRequest[] = day.requestIds.map(id => ({ id }));

        if (existing) {
          existing.outCount += outCount;
          existing.conflict = existing.conflict || conflict;
          existing.requests.push(...requests);
          existing.capacityPct = capacityTierPct(existing.outCount, existing.conflict);
        } else {
          perDate.set(day.date, {
            date: day.date,
            teamId: team.teamId,
            teamName: team.teamName,
            outCount,
            capacityPct: capacityTierPct(outCount, conflict),
            conflict,
            holiday: holidayByDate.has(day.date)
              ? { name: holidayByDate.get(day.date) as string }
              : null,
            requests,
          });
        }
      }
    }

    return [...perDate.values()];
  }, [calendarQuery.data, holidayByDate]);

  const handleViewModeChange = useCallback(
    (next: string) => void setViewMode(next === 'quarter' ? 'quarter' : 'month'),
    [setViewMode],
  );

  const handlePrev = useCallback(
    () => void setAnchor(isoDay(addMonths(anchorDate, -monthCount))),
    [setAnchor, anchorDate, monthCount],
  );
  const handleNext = useCallback(
    () => void setAnchor(isoDay(addMonths(anchorDate, monthCount))),
    [setAnchor, anchorDate, monthCount],
  );
  const handleTeamChange = useCallback((next: string) => void setTeamId(next), [setTeamId]);

  const isLoading = calendarQuery.isLoading;
  const isError = calendarQuery.isError;
  const isEmpty =
    !(isLoading || isError) && days.every(day => day.outCount === 0 && day.holiday == null);

  return {
    viewMode,
    onViewModeChange: handleViewModeChange,
    anchorDate: from,
    monthCount,
    onPrev: handlePrev,
    onNext: handleNext,
    teamId,
    teamOptions,
    onTeamChange: handleTeamChange,
    isLoading,
    isError,
    isEmpty,
    onRetry: () => void calendarQuery.refetch(),
    days,
  } as const;
}
