/**
 * Container for the payroll export surface: calls the sole-boundary hook, owns
 * the employee-id entry state, and renders the section loading / empty / error
 * states before handing presentational props to the panel. No direct tRPC here.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { useMemo, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { usePayrollExport } from './hooks/use-payroll-export.js';
import { PayrollExportPanel } from './payroll-export-panel.js';

function parseEmployeeIds(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map(id => id.trim())
    .filter(Boolean);
}

export function PayrollExportContainer() {
  const t = useTranslations('PayrollExport');
  const px = usePayrollExport();
  const [employeeIdsText, setEmployeeIdsText] = useState('');

  const employeeIds = useMemo(() => parseEmployeeIds(employeeIdsText), [employeeIdsText]);

  if (px.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" data-testid="payroll-export-loading">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (px.isError) {
    return (
      <div className="space-y-3 rounded-lg border border-destructive/40 p-4" role="alert">
        <p className="text-sm text-destructive">{t('errors.load')}</p>
        <Button type="button" variant="outline" onClick={px.retry}>
          {t('errors.retry')}
        </Button>
      </div>
    );
  }

  if (px.targets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      </div>
    );
  }

  return (
    <PayrollExportPanel
      targets={px.targets}
      employeeIdsText={employeeIdsText}
      onEmployeeIdsChange={setEmployeeIdsText}
      hasEmployeeIds={employeeIds.length > 0}
      onExport={(targetId, format) => px.runExport(targetId, employeeIds, format)}
      isExporting={px.isExporting}
      exportingTargetId={px.exportingTargetId}
    />
  );
}
