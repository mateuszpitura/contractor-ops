import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { CheckCircle2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from '../../i18n/useTranslations.js';

import type { ImportRow } from './import-wizard-dialog.js';
import { ImportPreviewDataTable } from './step-preview/data-table.js';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface StepPreviewProps {
  validRows: ImportRow[];
  invalidRows: ImportRow[];
  totalRows: number;
}

export function StepPreview({ validRows, invalidRows, totalRows }: StepPreviewProps) {
  const t = useTranslations('Import');
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);

  const allRows = useMemo(
    () => [...validRows, ...invalidRows].sort((a, b) => a.rowNumber - b.rowNumber),
    [validRows, invalidRows],
  );

  const displayRows = showErrorsOnly ? invalidRows : allRows;

  // Build a set of (rowNumber, field) pairs that have errors
  const errorCells = useMemo(() => {
    const set = new Set<string>();
    for (const row of invalidRows) {
      for (const err of row.errors) {
        set.add(`${row.rowNumber}:${err.field}`);
      }
    }
    return set;
  }, [invalidRows]);

  // Build error message lookup
  const errorMessages = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of invalidRows) {
      for (const err of row.errors) {
        map.set(`${row.rowNumber}:${err.field}`, err.message);
      }
    }
    return map;
  }, [invalidRows]);

  const hasNoInvalidRows = invalidRows.length === 0;

  const showAll = useCallback(() => setShowErrorsOnly(false), []);
  const showErrors = useCallback(() => setShowErrorsOnly(true), []);

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm">
        <span className="font-semibold text-emerald-600">
          {t('preview.validRows', { count: validRows.length })}
        </span>
        <span className="font-semibold text-destructive">
          {t('preview.invalidRows', { count: invalidRows.length })}
        </span>
        <span className="text-muted-foreground">
          {t('preview.totalRows', { count: totalRows })}
        </span>
      </div>

      {/* Toggle filter */}
      {!hasNoInvalidRows && (
        <div className="flex gap-2">
          <Button
            variant={showErrorsOnly ? 'outline' : 'default'}
            size="sm"
            onClick={showAll}
            type="button">
            {t('preview.showAll')}
          </Button>
          <Button
            variant={showErrorsOnly ? 'default' : 'outline'}
            size="sm"
            onClick={showErrors}
            type="button">
            {t('preview.showErrors')}
          </Button>
        </div>
      )}

      {/* All valid message */}
      {hasNoInvalidRows && validRows.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle2 className="size-4" />
          <span>{t('preview.allValid', { count: validRows.length })}</span>
        </div>
      )}

      {/* Empty state */}
      {totalRows === 0 && (
        <div className="text-sm text-muted-foreground">{t('preview.noRows')}</div>
      )}

      {/* Data table */}
      {totalRows > 0 && (
        <ImportPreviewDataTable
          rows={displayRows}
          allRows={allRows}
          errorCells={errorCells}
          errorMessages={errorMessages}
        />
      )}
    </div>
  );
}
