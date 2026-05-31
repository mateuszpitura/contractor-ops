'use client';

import { X } from 'lucide-react';
import { useCallback, useState } from 'react';

import { useUITranslations } from '../../../i18n/translations-provider.js';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../shadcn/alert-dialog.js';
import { Button } from '../../shadcn/button.js';
import type { DataTableBulkAction } from './types.js';

interface DataTableBulkActionsProps<TData> {
  selectedRows: TData[];
  actions: DataTableBulkAction<TData>[];
  onClearSelection: () => void;
  disabled?: boolean;
}

/**
 * Renders the bulk-action bar above the table when at least one row is
 * selected. Each action descriptor becomes a button; actions with a
 * `confirm` block are wrapped in an AlertDialog.
 */
export function DataTableBulkActions<TData>({
  selectedRows,
  actions,
  onClearSelection,
  disabled = false,
}: DataTableBulkActionsProps<TData>) {
  const t = useUITranslations();
  const [pendingAction, setPendingAction] = useState<DataTableBulkAction<TData> | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const runAction = useCallback(
    async (action: DataTableBulkAction<TData>) => {
      setBusyId(action.id);
      try {
        await action.onRun(selectedRows);
      } finally {
        setBusyId(null);
      }
    },
    [selectedRows],
  );

  const handleClick = useCallback(
    (action: DataTableBulkAction<TData>) => {
      if (action.confirm) {
        setPendingAction(action);
      } else {
        void runAction(action);
      }
    },
    [runAction],
  );

  const handleConfirm = useCallback(() => {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    void runAction(action);
  }, [pendingAction, runAction]);

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) setPendingAction(null);
  }, []);

  if (selectedRows.length === 0) return null;

  return (
    <>
      <section
        aria-label={t('aria.bulkActions')}
        className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
        <span className="text-sm font-medium tabular-nums text-foreground">
          {selectedRows.length}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          onClick={onClearSelection}
          aria-label={t('aria.clearSelection')}
          disabled={disabled}>
          <X className="h-3 w-3" />
          {t('aria.clearSelection')}
        </Button>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {actions.map(action => (
            <BulkActionButton
              key={action.id}
              action={action}
              disabled={disabled || busyId === action.id}
              onActivate={handleClick}
            />
          ))}
        </div>
      </section>
      {pendingAction?.confirm ? (
        <AlertDialog open onOpenChange={handleDialogOpenChange}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{pendingAction.confirm.title}</AlertDialogTitle>
              <AlertDialogDescription>{pendingAction.confirm.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                {pendingAction.confirm.cancelLabel ?? t('aria.clearSelection')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirm}
                className={
                  pendingAction.variant === 'destructive'
                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                    : undefined
                }>
                {pendingAction.confirm.confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
}

interface BulkActionButtonProps<TData> {
  action: DataTableBulkAction<TData>;
  disabled: boolean;
  onActivate: (action: DataTableBulkAction<TData>) => void;
}

function BulkActionButton<TData>({ action, disabled, onActivate }: BulkActionButtonProps<TData>) {
  const Icon = action.icon;
  const handleClick = useCallback(() => onActivate(action), [action, onActivate]);
  return (
    <Button
      type="button"
      size="sm"
      variant={action.variant === 'destructive' ? 'destructive' : 'outline'}
      disabled={disabled}
      onClick={handleClick}>
      <Icon className="h-3.5 w-3.5" />
      {action.label}
    </Button>
  );
}
