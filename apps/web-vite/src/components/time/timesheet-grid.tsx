import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { ScrollArea, ScrollBar } from '@contractor-ops/ui/components/shadcn/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { addDays, format, startOfISOWeek } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { cn } from '../../lib/utils.js';
import { TimeSourceBadge } from './time-source-badge.js';

interface TimeEntry {
  id: string;
  contractId: string;
  entryDate: string | Date;
  minutes: number;
  description?: string | null;
  source: 'MANUAL' | 'CLOCKIFY' | 'JIRA';
  externalId?: string | null;
  createdAt?: string | Date;
  contract?: { id: string; title: string } | null;
}

interface Contract {
  id: string;
  title: string;
  rateType?: string | null;
  rateValueMinor?: number | null;
}

interface TimesheetGridProps {
  weekStartDate: Date;
  entries: TimeEntry[];
  contracts: Contract[];
  timesheetId: string;
  disabled: boolean;
  rejectionReason?: string | null;
  onSave: (
    entries: Array<{
      id?: string;
      contractId: string;
      entryDate: string;
      minutes: number;
      description?: string;
    }>,
  ) => void;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getDateForDay(weekStart: Date, dayIndex: number): string {
  const date = addDays(startOfISOWeek(weekStart), dayIndex);
  return format(date, 'yyyy-MM-dd');
}

function minutesToHours(minutes: number): string {
  if (minutes === 0) return '';
  const hours = minutes / 60;
  return hours % 1 === 0 ? hours.toFixed(0) : hours.toFixed(2);
}

function hoursToMinutes(hours: string): number {
  const val = parseFloat(hours);
  if (Number.isNaN(val) || val < 0) return 0;
  return Math.round(Math.min(val, 24) * 60);
}

function toDateStr(d: string | Date): string {
  if (typeof d === 'string') return d.split('T')[0] ?? d;
  return format(d, 'yyyy-MM-dd');
}

interface TimesheetCellInputProps {
  contractId: string;
  dayIndex: number;
  contractIndex: number;
  cellKey: string;
  value: string;
  disabled: boolean;
  ariaLabel: string;
  setInputRef: (cellKey: string, el: HTMLInputElement | null) => void;
  onCellChange: (contractId: string, dayIndex: number, value: string) => void;
  onCellBlur: (contractId: string, dayIndex: number) => void;
  onCellKeyDown: (
    e: React.KeyboardEvent,
    contractId: string,
    dayIndex: number,
    contractIndex: number,
  ) => void;
}

function TimesheetCellInput({
  contractId,
  dayIndex,
  contractIndex,
  cellKey,
  value,
  disabled,
  ariaLabel,
  setInputRef,
  onCellChange,
  onCellBlur,
  onCellKeyDown,
}: TimesheetCellInputProps) {
  const handleRef = useCallback(
    (el: HTMLInputElement | null) => setInputRef(cellKey, el),
    [setInputRef, cellKey],
  );
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onCellChange(contractId, dayIndex, e.target.value),
    [onCellChange, contractId, dayIndex],
  );
  const handleBlur = useCallback(
    () => onCellBlur(contractId, dayIndex),
    [onCellBlur, contractId, dayIndex],
  );
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => onCellKeyDown(e, contractId, dayIndex, contractIndex),
    [onCellKeyDown, contractId, dayIndex, contractIndex],
  );

  return (
    <Input
      ref={handleRef}
      type="number"
      step="0.25"
      min="0"
      max="24"
      className="h-10 w-16 text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      aria-label={ariaLabel}
    />
  );
}

export function TimesheetGrid({
  weekStartDate,
  entries,
  contracts,
  timesheetId: _timesheetId,
  disabled,
  rejectionReason,
  onSave,
}: TimesheetGridProps) {
  const t = useTranslations('Time');

  const entryMap = useMemo(() => {
    const map = new Map<string, Map<number, TimeEntry>>();
    for (const entry of entries) {
      const dateStr = toDateStr(entry.entryDate);
      const contractId = entry.contractId;
      if (!map.has(contractId)) map.set(contractId, new Map());
      const contractEntries = map.get(contractId);
      if (!contractEntries) continue;
      for (let i = 0; i < 7; i++) {
        if (getDateForDay(weekStartDate, i) === dateStr) {
          contractEntries.set(i, entry);
          break;
        }
      }
    }
    return map;
  }, [entries, weekStartDate]);

  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const getCellKey = useCallback(
    (contractId: string, dayIndex: number) => `${contractId}-${dayIndex}`,
    [],
  );

  const getCellValue = (contractId: string, dayIndex: number): string => {
    const key = getCellKey(contractId, dayIndex);
    if (key in localValues) return localValues[key] ?? '';
    const entry = entryMap.get(contractId)?.get(dayIndex);
    return entry ? minutesToHours(entry.minutes) : '';
  };

  const isCellImported = (contractId: string, dayIndex: number): boolean => {
    const entry = entryMap.get(contractId)?.get(dayIndex);
    return entry ? entry.source !== 'MANUAL' : false;
  };

  const getCellSource = (contractId: string, dayIndex: number): TimeEntry['source'] | null => {
    const entry = entryMap.get(contractId)?.get(dayIndex);
    return entry?.source ?? null;
  };

  const setInputRef = useCallback((cellKey: string, el: HTMLInputElement | null) => {
    if (el) inputRefs.current.set(cellKey, el);
    else inputRefs.current.delete(cellKey);
  }, []);

  const handleCellChange = useCallback(
    (contractId: string, dayIndex: number, value: string) => {
      const key = getCellKey(contractId, dayIndex);
      setLocalValues(prev => ({ ...prev, [key]: value }));
    },
    [getCellKey],
  );

  const handleCellBlur = useCallback(
    (contractId: string, dayIndex: number) => {
      const key = getCellKey(contractId, dayIndex);
      const rawValue = localValues[key];
      if (rawValue === undefined) return;

      const minutes = hoursToMinutes(rawValue);
      const existingEntry = entryMap.get(contractId)?.get(dayIndex);
      const dateStr = getDateForDay(weekStartDate, dayIndex);

      if (existingEntry && existingEntry.minutes === minutes) {
        setLocalValues(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        return;
      }

      onSave([
        {
          id: existingEntry?.id,
          contractId,
          entryDate: dateStr,
          minutes,
          description: existingEntry?.description ?? undefined,
        },
      ]);

      setLocalValues(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [localValues, entryMap, weekStartDate, onSave, getCellKey],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, contractId: string, dayIndex: number, contractIndex: number) => {
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        handleCellBlur(contractId, dayIndex);

        let nextContractIdx = contractIndex;
        let nextDayIdx = dayIndex;

        if (e.key === 'Enter') {
          nextContractIdx = (contractIndex + 1) % contracts.length;
        } else {
          nextDayIdx = dayIndex + 1;
          if (nextDayIdx > 6) {
            nextDayIdx = 0;
            nextContractIdx = (contractIndex + 1) % contracts.length;
          }
        }

        const nextContract = contracts[nextContractIdx];
        if (nextContract) {
          const nextKey = getCellKey(nextContract.id, nextDayIdx);
          inputRefs.current.get(nextKey)?.focus();
        }
      }
    },
    [contracts, getCellKey, handleCellBlur],
  );

  const getRowTotal = (contractId: string): number => {
    let total = 0;
    for (let i = 0; i < 7; i++) {
      const key = getCellKey(contractId, i);
      if (key in localValues) {
        total += hoursToMinutes(localValues[key] ?? '');
      } else {
        const entry = entryMap.get(contractId)?.get(i);
        total += entry?.minutes ?? 0;
      }
    }
    return total;
  };

  const getColumnTotal = (dayIndex: number): number => {
    let total = 0;
    for (const contract of contracts) {
      const key = getCellKey(contract.id, dayIndex);
      if (key in localValues) {
        total += hoursToMinutes(localValues[key] ?? '');
      } else {
        const entry = entryMap.get(contract.id)?.get(dayIndex);
        total += entry?.minutes ?? 0;
      }
    }
    return total;
  };

  const grandTotal = contracts.reduce((sum, c) => sum + getRowTotal(c.id), 0);

  if (contracts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">{t('grid.noActiveContracts')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {!!rejectionReason && (
        <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            {t('grid.rejectionBanner', { reason: rejectionReason })}
          </p>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px] min-w-[200px] px-4 py-3 text-sm">
                    {t('grid.project')}
                  </TableHead>
                  {DAY_LABELS.map((day, i) => (
                    <TableHead
                      key={day}
                      className="w-16 min-w-[64px] px-1 py-3 text-center text-sm">
                      <div>{day}</div>
                      <div className="text-xs font-normal text-muted-foreground">
                        {format(addDays(startOfISOWeek(weekStartDate), i), 'd')}
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="w-16 min-w-[64px] px-2 py-3 text-center text-sm">
                    {t('grid.total')}
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {contracts.map((contract, contractIdx) => {
                  const rowTotal = getRowTotal(contract.id);
                  return (
                    <TableRow key={contract.id}>
                      <TableCell className="px-4 py-2">
                        <span
                          className="block max-w-[200px] truncate text-sm"
                          title={contract.title}>
                          {contract.title}
                        </span>
                      </TableCell>
                      {DAY_LABELS.map((_, dayIdx) => {
                        const cellKey = getCellKey(contract.id, dayIdx);
                        const imported = isCellImported(contract.id, dayIdx);
                        const source = getCellSource(contract.id, dayIdx);
                        const cellDisabled = disabled || imported;

                        return (
                          // biome-ignore lint/suspicious/noArrayIndexKey: fixed weekday columns
                          <TableCell
                            key={dayIdx}
                            className={cn('px-1 py-1.5', imported && 'bg-muted/50')}>
                            <div className="relative">
                              <TimesheetCellInput
                                contractId={contract.id}
                                dayIndex={dayIdx}
                                contractIndex={contractIdx}
                                cellKey={cellKey}
                                value={getCellValue(contract.id, dayIdx)}
                                disabled={cellDisabled}
                                ariaLabel={t('grid.hoursAriaLabel', {
                                  project: contract.title,
                                  day: DAY_LABELS[dayIdx] ?? '',
                                })}
                                setInputRef={setInputRef}
                                onCellChange={handleCellChange}
                                onCellBlur={handleCellBlur}
                                onCellKeyDown={handleKeyDown}
                              />
                              {source && source !== 'MANUAL' && (
                                <div className="absolute -top-1 -end-1">
                                  <TimeSourceBadge
                                    source={source}
                                    importedAt={entryMap.get(contract.id)?.get(dayIdx)?.createdAt}
                                  />
                                </div>
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                      <TableCell className="px-2 py-2 text-center text-sm font-medium">
                        {minutesToHours(rowTotal) || '0'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>

              <TableFooter>
                <TableRow>
                  <TableCell className="px-4 py-3 text-sm font-semibold">
                    {t('grid.total')}
                  </TableCell>
                  {DAY_LABELS.map((_, dayIdx) => {
                    const colTotal = getColumnTotal(dayIdx);
                    return (
                      // biome-ignore lint/suspicious/noArrayIndexKey: fixed weekday columns
                      <TableCell
                        key={dayIdx}
                        className="px-1 py-3 text-center text-sm font-semibold">
                        {minutesToHours(colTotal) || '0'}
                      </TableCell>
                    );
                  })}
                  <TableCell className="px-2 py-3 text-center text-sm font-semibold text-primary">
                    {minutesToHours(grandTotal) || '0'}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
