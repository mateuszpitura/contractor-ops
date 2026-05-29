/**
 * Per-contractor timesheet review view. Ported from
 * apps/web/src/components/time/contractor-timesheet-review.tsx:
 *   - next-intl → ../../i18n/useTranslations.js
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { ScrollArea, ScrollBar } from '@contractor-ops/ui/components/shadcn/scroll-area';
import { addDays, format, startOfISOWeek } from 'date-fns';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { RejectionReasonDialog } from './rejection-reason-dialog.js';
import { TimeEntryStatusBadge } from './time-entry-status-badge.js';
import { TimeSourceBadge } from './time-source-badge.js';

interface TimeEntry {
  id: string;
  contractId: string;
  entryDate: string | Date;
  minutes: number;
  description?: string | null;
  source: 'MANUAL' | 'CLOCKIFY' | 'JIRA';
  createdAt?: string | Date;
  contract?: { id: string; title: string } | null;
}

interface TimesheetData {
  id: string;
  weekStartDate: string | Date;
  totalMinutes: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
  entries: TimeEntry[];
  contractor: {
    id: string;
    legalName: string;
    email: string | null;
  };
}

interface ContractorTimesheetReviewProps {
  timesheet: TimesheetData;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onBack: () => void;
  isApproving?: boolean;
  isRejecting?: boolean;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getDateForDay(weekStart: Date, dayIndex: number): string {
  const date = addDays(startOfISOWeek(weekStart), dayIndex);
  return format(date, 'yyyy-MM-dd');
}

function minutesToHours(minutes: number): string {
  if (minutes === 0) return '';
  const hours = minutes / 60;
  return hours % 1 === 0 ? hours.toFixed(0) : hours.toFixed(1);
}

function toDateStr(d: string | Date): string {
  if (typeof d === 'string') return d.split('T')[0] ?? d;
  return format(d, 'yyyy-MM-dd');
}

function resolveDayIndex(entry: TimeEntry, weekStart: Date): number {
  const dateStr = toDateStr(entry.entryDate);
  for (let i = 0; i < 7; i++) {
    if (getDateForDay(weekStart, i) === dateStr) {
      return i;
    }
  }
  return -1;
}

export function ContractorTimesheetReview({
  timesheet,
  onApprove,
  onReject,
  onBack,
  isApproving = false,
  isRejecting = false,
}: ContractorTimesheetReviewProps) {
  const t = useTranslations('Time');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  const weekStart =
    typeof timesheet.weekStartDate === 'string'
      ? new Date(timesheet.weekStartDate)
      : timesheet.weekStartDate;

  const periodLabel = `${format(startOfISOWeek(weekStart), 'MMM d')} - ${format(addDays(startOfISOWeek(weekStart), 6), 'MMM d, yyyy')}`;

  const contractMap = useMemo(() => {
    const map = new Map<string, { title: string; entries: Map<number, TimeEntry> }>();
    for (const entry of timesheet.entries) {
      const contractId = entry.contractId;
      const title = entry.contract?.title ?? 'Unknown Project';
      if (!map.has(contractId)) {
        map.set(contractId, { title, entries: new Map() });
      }
      const contractData = map.get(contractId);
      if (!contractData) continue;
      const dayIdx = resolveDayIndex(entry, weekStart);
      if (dayIdx >= 0) {
        contractData.entries.set(dayIdx, entry);
      }
    }
    return map;
  }, [timesheet.entries, weekStart]);

  const contracts = useMemo(() => Array.from(contractMap.entries()), [contractMap]);

  const entriesWithDescriptions = useMemo(
    () => timesheet.entries.filter(e => e.description && e.description.trim().length > 0),
    [timesheet.entries],
  );

  const handleReject = useCallback(
    (reason: string) => {
      onReject(reason);
      setRejectDialogOpen(false);
    },
    [onReject],
  );

  const openRejectDialog = useCallback(() => setRejectDialogOpen(true), []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold">{timesheet.contractor.legalName}</h2>
            <p className="text-sm text-muted-foreground">{periodLabel}</p>
          </div>
          <TimeEntryStatusBadge status={timesheet.status} />
        </div>
        <div className="text-end">
          <p className="text-2xl font-semibold text-primary">
            {minutesToHours(timesheet.totalMinutes) || '0'}h
          </p>
          <p className="text-xs text-muted-foreground">{t('review.totalHours')}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="w-[200px] min-w-[200px] px-4 py-3 text-start text-sm font-semibold">
                    {t('review.project')}
                  </th>
                  {DAY_LABELS.map((day, i) => (
                    <th
                      key={day}
                      className="w-16 min-w-[64px] px-1 py-3 text-center text-sm font-semibold">
                      <div>{day}</div>
                      <div className="text-xs font-normal text-muted-foreground">
                        {format(addDays(startOfISOWeek(weekStart), i), 'd')}
                      </div>
                    </th>
                  ))}
                  <th className="w-16 min-w-[64px] px-2 py-3 text-center text-sm font-semibold">
                    {t('review.total')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {contracts.map(([contractId, { title, entries }]) => {
                  let rowTotal = 0;
                  return (
                    <tr key={contractId} className="border-b last:border-b-0">
                      <td className="px-4 py-2">
                        <span className="block max-w-[200px] truncate text-sm" title={title}>
                          {title}
                        </span>
                      </td>
                      {DAY_LABELS.map((_, dayIdx) => {
                        const entry = entries.get(dayIdx);
                        const mins = entry?.minutes ?? 0;
                        rowTotal += mins;
                        return (
                          // biome-ignore lint/suspicious/noArrayIndexKey: fixed weekday columns
                          <td key={dayIdx} className="px-1 py-2 text-center text-sm">
                            <div className="relative inline-flex items-center justify-center">
                              <span className={mins > 0 ? 'font-medium' : 'text-muted-foreground'}>
                                {mins > 0 ? minutesToHours(mins) : '-'}
                              </span>
                              {entry && entry.source !== 'MANUAL' && (
                                <div className="absolute -top-2 -end-3">
                                  <TimeSourceBadge
                                    source={entry.source}
                                    importedAt={entry.createdAt}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-center text-sm font-medium">
                        {minutesToHours(rowTotal) || '0'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t">
                  <td className="px-4 py-3 text-sm font-semibold">{t('review.total')}</td>
                  {DAY_LABELS.map((_, dayIdx) => {
                    let colTotal = 0;
                    for (const [, { entries }] of contracts) {
                      colTotal += entries.get(dayIdx)?.minutes ?? 0;
                    }
                    return (
                      // biome-ignore lint/suspicious/noArrayIndexKey: fixed weekday columns
                      <td key={dayIdx} className="px-1 py-3 text-center text-sm font-semibold">
                        {minutesToHours(colTotal) || '0'}
                      </td>
                    );
                  })}
                  <td className="px-2 py-3 text-center text-sm font-semibold text-primary">
                    {minutesToHours(timesheet.totalMinutes) || '0'}
                  </td>
                </tr>
              </tfoot>
            </table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>

      {entriesWithDescriptions.length > 0 && (
        <Card>
          <CardContent className="divide-y p-0">
            {entriesWithDescriptions.map(entry => (
              <div key={entry.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {format(
                        typeof entry.entryDate === 'string'
                          ? new Date(entry.entryDate)
                          : entry.entryDate,
                        'EEE, MMM d',
                      )}
                    </span>
                    <span>&middot;</span>
                    <span>{minutesToHours(entry.minutes)}h</span>
                    <TimeSourceBadge source={entry.source} importedAt={entry.createdAt} />
                  </div>
                  <p className="mt-1 text-sm">{entry.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="sticky bottom-0 z-40 -mx-1 border-t bg-background px-1 py-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="me-2 h-4 w-4" />
            {t('review.backToQueue')}
          </Button>
          <div className="flex items-center gap-2">
            {timesheet.status === 'SUBMITTED' && (
              <>
                <Button
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={openRejectDialog}>
                  <XCircle className="me-2 h-4 w-4" />
                  {t('review.reject')}
                </Button>
                <Button onClick={onApprove} disabled={isApproving}>
                  <CheckCircle className="me-2 h-4 w-4" />
                  {t('review.approveTimesheet')}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <RejectionReasonDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        onConfirm={handleReject}
        isSubmitting={isRejecting}
      />
    </div>
  );
}
