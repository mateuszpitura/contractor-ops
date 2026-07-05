import {
  AtelierEmptyState,
  QueryErrorPanel,
  SectionLabel,
  WORKBENCH_TABLE_SECTION_CLASS,
} from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@contractor-ops/ui/components/shadcn/tabs';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { renderEmptyStateAction } from '../shared/atelier-bridges.js';
import { useTeamCalendar } from './hooks/use-team-calendar.js';
import { TeamCalendarView } from './team-calendar/team-calendar-view.js';

const ALL_TEAMS = 'all';
const SKELETON_CELLS = Array.from({ length: 35 }, (_, index) => index);

function CalendarSkeleton() {
  return (
    <div className="grid grid-cols-7 gap-1" aria-hidden>
      {SKELETON_CELLS.map(cell => (
        <Skeleton key={cell} className="h-11 w-full rounded-md" />
      ))}
    </div>
  );
}

export function TeamCalendar() {
  const cal = useTeamCalendar();
  const t = useTranslations('Leave.calendar');
  const tNav = useTranslations('Common.pagination');

  const renderBody = () => {
    if (cal.isError) {
      return (
        <QueryErrorPanel
          message={t('error.message')}
          retryLabel={t('error.retry')}
          onRetry={cal.onRetry}
        />
      );
    }
    if (cal.isLoading) return <CalendarSkeleton />;
    if (cal.isEmpty) {
      return (
        <AtelierEmptyState
          variant="page"
          icon={CalendarRange}
          heading={t('empty.heading')}
          body={t('empty.body')}
          renderAction={renderEmptyStateAction}
        />
      );
    }
    return <TeamCalendarView viewMode={cal.viewMode} days={cal.days} anchorDate={cal.anchorDate} />;
  };

  return (
    <section aria-label={t('title')} className={WORKBENCH_TABLE_SECTION_CLASS}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SectionLabel icon={CalendarRange}>{t('sectionLabel')}</SectionLabel>
        <div className="flex flex-wrap items-center gap-2">
          {cal.teamOptions.length > 0 ? (
            <Select
              value={cal.teamId}
              onValueChange={value => cal.onTeamChange(value ?? ALL_TEAMS)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_TEAMS}>{t('legend.title')}</SelectItem>
                {cal.teamOptions.map(team => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name ?? t('unassignedTeam')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Tabs value={cal.viewMode} onValueChange={cal.onViewModeChange}>
            <TabsList>
              <TabsTrigger value="month">{t('viewMonth')}</TabsTrigger>
              <TabsTrigger value="quarter">{t('viewQuarter')}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label={tNav('previous')}
              onClick={cal.onPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" aria-label={tNav('next')} onClick={cal.onNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      {renderBody()}
    </section>
  );
}
