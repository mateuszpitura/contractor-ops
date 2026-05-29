import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { RadioGroup, RadioGroupItem } from '@contractor-ops/ui/components/shadcn/radio-group';
import { ScrollArea } from '@contractor-ops/ui/components/shadcn/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { AlertTriangle } from 'lucide-react';
import { useCallback } from 'react';
import { usePermissions } from '../../hooks/use-permissions.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { canViewSensitivePii, maskTaxId } from '../../lib/mask-pii.js';

import type { ImportRow } from './import-wizard-dialog.js';

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

  const getAction = (rowNumber: number): 'skip' | 'update' | 'create' => {
    return duplicateActions[String(rowNumber)] ?? 'skip';
  };

  const handleActionChange = useCallback(
    (rowNumber: number, action: 'skip' | 'update' | 'create') => {
      onActionsChange({
        ...duplicateActions,
        [String(rowNumber)]: action,
      });
    },
    [duplicateActions, onActionsChange],
  );

  const handleBulkAction = useCallback(
    (action: 'skip' | 'update') => {
      const newActions: Record<string, 'skip' | 'update' | 'create'> = {};
      for (const row of duplicateRows) {
        newActions[String(row.rowNumber)] = action;
      }
      onActionsChange(newActions);
    },
    [duplicateRows, onActionsChange],
  );

  const handleSkipAll = useCallback(() => handleBulkAction('skip'), [handleBulkAction]);
  const handleUpdateAll = useCallback(() => handleBulkAction('update'), [handleBulkAction]);

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

      {/* Duplicates table */}
      <ScrollArea className="max-h-[320px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('duplicates.taxId')}</TableHead>
              <TableHead>{t('duplicates.nameFromFile')}</TableHead>
              <TableHead>{t('duplicates.nameExisting')}</TableHead>
              <TableHead>{t('duplicates.action')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {duplicateRows.map(row => {
              const taxId = String(row.data.taxId ?? row.data.contractorTaxId ?? '');
              const name = String(row.data.legalName ?? row.data.title ?? '');
              const existingName = row.duplicateOf ?? '-';
              const action = getAction(row.rowNumber);

              return (
                <TableRow key={row.rowNumber}>
                  <TableCell className="font-mono text-sm">
                    {showPii ? taxId : maskTaxId(taxId)}
                  </TableCell>
                  <TableCell className="text-sm">{name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{existingName}</TableCell>
                  <TableCell>
                    <DuplicateActionRadio
                      rowNumber={row.rowNumber}
                      action={action}
                      onActionChange={handleActionChange}
                      labelSkip={t('duplicates.skip')}
                      labelUpdate={t('duplicates.update')}
                      labelCreate={t('duplicates.create')}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
