import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { RadioGroup, RadioGroupItem } from '@contractor-ops/ui/components/shadcn/radio-group';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { usePermissions } from '../../hooks/use-permissions.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { canViewSensitivePii, maskTaxId } from '../../lib/mask-pii.js';
import { WorkbenchDataTable } from '../table-kit/workbench-data-table.js';

import type { ImportRow } from './import-wizard-dialog.js';

const getDuplicateRowId = (row: ImportRow) => String(row.rowNumber);

type DuplicateAction = 'skip' | 'update' | 'create';

interface DuplicateActionRadioProps {
  rowNumber: number;
  action: DuplicateAction;
  onActionChange: (rowNumber: number, action: DuplicateAction) => void;
  labelSkip: string;
  labelUpdate: string;
  labelCreate: string;
}

function DuplicateActionRadio({
  rowNumber,
  action,
  onActionChange,
  labelSkip,
  labelUpdate,
  labelCreate,
}: DuplicateActionRadioProps) {
  const handleChange = useCallback(
    (val: string) => onActionChange(rowNumber, val as DuplicateAction),
    [onActionChange, rowNumber],
  );
  return (
    <RadioGroup value={action} onValueChange={handleChange} className="flex gap-3">
      <label
        htmlFor={`dup-${rowNumber}-skip`}
        className="flex cursor-pointer items-center gap-1.5 text-xs">
        <RadioGroupItem id={`dup-${rowNumber}-skip`} value="skip" />
        {labelSkip}
      </label>
      <label
        htmlFor={`dup-${rowNumber}-update`}
        className="flex cursor-pointer items-center gap-1.5 text-xs">
        <RadioGroupItem id={`dup-${rowNumber}-update`} value="update" />
        {labelUpdate}
      </label>
      <label
        htmlFor={`dup-${rowNumber}-create`}
        className="flex cursor-pointer items-center gap-1.5 text-xs">
        <RadioGroupItem id={`dup-${rowNumber}-create`} value="create" />
        {labelCreate}
      </label>
    </RadioGroup>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface StepDuplicatesProps {
  duplicateRows: ImportRow[];
  duplicateActions: Record<string, 'skip' | 'update' | 'create'>;
  onActionsChange: (actions: Record<string, 'skip' | 'update' | 'create'>) => void;
}

export function StepDuplicates({
  duplicateRows,
  duplicateActions,
  onActionsChange,
}: StepDuplicatesProps) {
  const t = useTranslations('Import');
  const { role } = usePermissions();
  const showPii = canViewSensitivePii(role);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const getAction = useCallback(
    (rowNumber: number): DuplicateAction => duplicateActions[String(rowNumber)] ?? 'skip',
    [duplicateActions],
  );

  const handleActionChange = useCallback(
    (rowNumber: number, action: DuplicateAction) => {
      onActionsChange({
        ...duplicateActions,
        [String(rowNumber)]: action,
      });
    },
    [duplicateActions, onActionsChange],
  );

  const handleBulkAction = useCallback(
    (action: 'skip' | 'update') => {
      const newActions: Record<string, DuplicateAction> = {};
      for (const row of duplicateRows) {
        newActions[String(row.rowNumber)] = action;
      }
      onActionsChange(newActions);
    },
    [duplicateRows, onActionsChange],
  );

  const handleSkipAll = useCallback(() => handleBulkAction('skip'), [handleBulkAction]);
  const handleUpdateAll = useCallback(() => handleBulkAction('update'), [handleBulkAction]);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPageIndex(0);
  }, []);

  const columns = useMemo<ColumnDef<ImportRow, unknown>[]>(
    () => [
      {
        id: 'taxId',
        accessorFn: row => String(row.data.taxId ?? row.data.contractorTaxId ?? ''),
        header: t('duplicates.taxId'),
        cell: ({ row }) => {
          const taxId = String(row.original.data.taxId ?? row.original.data.contractorTaxId ?? '');
          return <span className="font-mono text-sm">{showPii ? taxId : maskTaxId(taxId)}</span>;
        },
      },
      {
        id: 'nameFromFile',
        accessorFn: row => String(row.data.legalName ?? row.data.title ?? ''),
        header: t('duplicates.nameFromFile'),
        cell: ({ row }) => (
          <span className="text-sm">
            {String(row.original.data.legalName ?? row.original.data.title ?? '')}
          </span>
        ),
      },
      {
        id: 'nameExisting',
        accessorFn: row => row.duplicateOf ?? '',
        header: t('duplicates.nameExisting'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.duplicateOf ?? '-'}</span>
        ),
      },
      {
        id: 'action',
        header: t('duplicates.action'),
        enableSorting: false,
        cell: ({ row }) => (
          <DuplicateActionRadio
            rowNumber={row.original.rowNumber}
            action={getAction(row.original.rowNumber)}
            onActionChange={handleActionChange}
            labelSkip={t('duplicates.skip')}
            labelUpdate={t('duplicates.update')}
            labelCreate={t('duplicates.create')}
          />
        ),
      },
    ],
    [t, showPii, getAction, handleActionChange],
  );

  return (
    <div className="space-y-4">
      {/* Warning banner */}
      <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
        <AlertTriangle className="size-5 shrink-0 text-amber-500" />
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {t('duplicates.banner', { count: duplicateRows.length })}
        </p>
      </div>

      {/* Bulk action buttons */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleSkipAll} type="button">
          {t('duplicates.skipAll')}
        </Button>
        <Button variant="outline" size="sm" onClick={handleUpdateAll} type="button">
          {t('duplicates.updateAll')}
        </Button>
      </div>

      <WorkbenchDataTable
        sectionClassName=""
        columns={columns}
        data={duplicateRows}
        totalRows={duplicateRows.length}
        clientPagination
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={setPageIndex}
        onPageSizeChange={handlePageSizeChange}
        constrainHeight={false}
        hideDensityToggle
        hideChrome
        getRowId={getDuplicateRowId}
        entityLabel={t('duplicates.banner', { count: duplicateRows.length })}
        emptyTitle={t('duplicates.banner', { count: 0 })}
        noResultsTitle={t('duplicates.banner', { count: 0 })}
      />
    </div>
  );
}
