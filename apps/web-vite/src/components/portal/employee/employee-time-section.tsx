/**
 * Employee time section — the caller's own recorded time and ewidencja
 * snapshots (read-only). Presentational views only; the tRPC boundary is
 * `use-employee-time`.
 */

import { AlertCircle, Clock } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { SectionCard, SectionMessage, SectionSkeleton } from './employee-section-shell.js';
import type { EmployeeEwidencjaSnapshot, EmployeeTimeRecord } from './hooks/use-employee-time.js';
import { useEmployeeTime } from './hooks/use-employee-time.js';

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function formatDate(value: Date | string): string {
  return new Date(value).toLocaleDateString();
}

interface EmployeeTimeSectionViewProps {
  timeRecords: EmployeeTimeRecord[];
  ewidencja: EmployeeEwidencjaSnapshot[];
}

export function EmployeeTimeSectionView({ timeRecords, ewidencja }: EmployeeTimeSectionViewProps) {
  const t = useTranslations('Portal.employee.time');

  return (
    <SectionCard icon={Clock} title={t('title')} description={t('description')}>
      <div className="space-y-5">
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">{t('recentHeading')}</h3>
          {timeRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noTime')}</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {timeRecords.map(record => (
                <li key={record.id} className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-sm">{formatDate(record.workDate)}</span>
                  <span className="text-sm font-medium tabular-nums">
                    {formatHours(record.workedMinutes)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            {t('ewidencjaHeading')}
          </h3>
          {ewidencja.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noEwidencja')}</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {ewidencja.map(snapshot => (
                <li key={snapshot.id} className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-sm font-medium">{snapshot.periodKey}</span>
                  <span className="text-xs text-muted-foreground">
                    {t('version', { version: snapshot.version })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

export function EmployeeTimeSection() {
  const t = useTranslations('Portal.employee.time');
  const time = useEmployeeTime();

  if (time.isLoading) return <SectionSkeleton rows={4} />;
  if (time.isUnavailable) {
    return (
      <SectionCard icon={Clock} title={t('title')}>
        <SectionMessage icon={Clock} title={t('unavailableTitle')} description={t('unavailable')} />
      </SectionCard>
    );
  }
  if (time.isError) {
    return (
      <SectionCard icon={Clock} title={t('title')}>
        <SectionMessage
          icon={AlertCircle}
          tone="danger"
          title={t('errorTitle')}
          description={t('error')}
        />
      </SectionCard>
    );
  }

  return <EmployeeTimeSectionView timeRecords={time.timeRecords} ewidencja={time.ewidencja} />;
}
