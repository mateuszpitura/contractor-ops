import type { LucideIcon } from 'lucide-react';
import { Clock, FileWarning, ShieldAlert, Users, UsersRound } from 'lucide-react';
import { useCallback } from 'react';
import { tKey } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { cn } from '../../lib/utils.js';

const REPORT_TYPES: Array<{
  id: string;
  icon: LucideIcon;
  labelKey: string;
}> = [
  { id: 'spend-contractor', icon: Users, labelKey: 'spendByContractor' },
  { id: 'spend-team', icon: UsersRound, labelKey: 'spendByTeam' },
  { id: 'expiring-contracts', icon: FileWarning, labelKey: 'expiringContracts' },
  { id: 'overdue-invoices', icon: Clock, labelKey: 'overdueInvoices' },
  { id: 'compliance-gaps', icon: ShieldAlert, labelKey: 'complianceGaps' },
];

interface ReportSidebarProps {
  activeReport: string;
  onSelect: (report: string) => void;
}

interface ReportButtonProps {
  reportId: string;
  Icon: LucideIcon;
  label: string;
  onSelect: (report: string) => void;
  className: string;
  iconClassName: string;
  labelClassName: string;
}

function ReportButton({
  reportId,
  Icon,
  label,
  onSelect,
  className,
  iconClassName,
  labelClassName,
}: ReportButtonProps) {
  const handleClick = useCallback(() => onSelect(reportId), [onSelect, reportId]);
  return (
    <button type="button" onClick={handleClick} className={className}>
      <Icon className={iconClassName} />
      <span className={labelClassName}>{label}</span>
    </button>
  );
}

export function ReportSidebar({ activeReport, onSelect }: ReportSidebarProps) {
  const t = useTranslations('Reports');

  return (
    <>
      {/* Desktop: vertical sidebar */}
      <nav className="hidden w-[220px] shrink-0 lg:block">
        <ul className="space-y-0.5">
          {REPORT_TYPES.map(report => {
            const isActive = activeReport === report.id;
            return (
              <li key={report.id}>
                <ReportButton
                  reportId={report.id}
                  Icon={report.icon}
                  label={tKey(t, report.labelKey)}
                  onSelect={onSelect}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'border-l-[3px] border-primary bg-primary/5 text-primary'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                  iconClassName="h-4 w-4 shrink-0"
                  labelClassName="truncate"
                />
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Mobile: horizontal scrollable pill bar */}
      <nav className="lg:hidden">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {REPORT_TYPES.map(report => {
            const isActive = activeReport === report.id;
            return (
              <ReportButton
                key={report.id}
                reportId={report.id}
                Icon={report.icon}
                label={tKey(t, report.labelKey)}
                onSelect={onSelect}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
                iconClassName="h-3.5 w-3.5"
                labelClassName=""
              />
            );
          })}
        </div>
      </nav>
    </>
  );
}
