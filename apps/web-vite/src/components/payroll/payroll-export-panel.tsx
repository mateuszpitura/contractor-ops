/**
 * Presentational payroll export panel: employee-id entry + a list of export
 * targets, each with a per-adapter enablement state. No data layer here — the
 * container owns the hook; this component is props in, JSX out.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';

import { useTranslations } from '../../i18n/useTranslations.js';
import type { PayrollTarget } from './hooks/use-payroll-export.js';

interface PayrollExportPanelProps {
  targets: PayrollTarget[];
  employeeIdsText: string;
  onEmployeeIdsChange: (value: string) => void;
  hasEmployeeIds: boolean;
  onExport: (targetId: string, format?: 'csv' | 'xml') => void;
  isExporting: boolean;
  exportingTargetId?: string;
}

const COUNTRY_LABELS: Record<string, string> = {
  PL: 'PL',
  DE: 'DE',
  GB: 'UK',
  US: 'US',
};

export function PayrollExportPanel({
  targets,
  employeeIdsText,
  onEmployeeIdsChange,
  hasEmployeeIds,
  onExport,
  isExporting,
  exportingTargetId,
}: PayrollExportPanelProps) {
  const t = useTranslations('PayrollExport');

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="payroll-employee-ids" className="block text-sm font-medium">
          {t('employeeIds.label')}
        </label>
        <textarea
          id="payroll-employee-ids"
          className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder={t('employeeIds.placeholder')}
          value={employeeIdsText}
          onChange={event => onEmployeeIdsChange(event.target.value)}
          aria-describedby="payroll-employee-ids-hint"
        />
        <p id="payroll-employee-ids-hint" className="text-xs text-muted-foreground">
          {t('employeeIds.hint')}
        </p>
      </div>

      <ul className="space-y-3" aria-label={t('targets.heading')}>
        {targets.map(target => {
          const supportsXml = target.profileId === 'symfonia';
          const busy = isExporting && exportingTargetId === target.profileId;
          const disabled = !(target.enabled && hasEmployeeIds) || isExporting;
          return (
            <li
              key={target.profileId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {COUNTRY_LABELS[target.country] ?? target.country}
                  </span>
                  <span className="truncate font-medium">{target.displayName}</span>
                </div>
                {!target.enabled && (
                  <p className="mt-1 text-xs text-muted-foreground">{t('targets.notEnabled')}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={disabled}
                  onClick={() => onExport(target.profileId, supportsXml ? 'csv' : undefined)}>
                  {busy ? t('actions.exporting') : t('actions.exportCsv')}
                </Button>
                {supportsXml && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled}
                    onClick={() => onExport(target.profileId, 'xml')}>
                    {t('actions.exportXml')}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
