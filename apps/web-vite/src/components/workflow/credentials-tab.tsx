import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { AlertCircle, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslations } from '../../i18n/useTranslations.js';
import type { CredentialRow } from './hooks/use-credentials-tab.js';

export interface CredentialsTabProps {
  rows: CredentialRow[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onAdd: () => void;
  onMarkRotated: (id: string) => void;
  onRemove: (id: string) => void;
  isMutating: boolean;
}

const STATUS_VARIANT = {
  PENDING: 'secondary',
  ROTATED: 'default',
  NOT_APPLICABLE: 'outline',
} as const;

// Enum label lookup via the i18n catalog — falls back to the raw value
// for any unknown enum variant so rendering never silently breaks (INFO-1).
function useLabelFns() {
  const t = useTranslations('Workflow.credentials');
  return {
    labelVaultProvider: (raw: string) => {
      try {
        return t(`providers.${raw}` as Parameters<typeof t>[0]);
      } catch {
        return raw;
      }
    },
    labelAccessType: (raw: string) => {
      try {
        return t(`accessTypes.${raw}` as Parameters<typeof t>[0]);
      } catch {
        return raw;
      }
    },
    labelStatus: (raw: string) => {
      try {
        return t(`status.${raw}` as Parameters<typeof t>[0]);
      } catch {
        return raw;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Remove confirm dialog (WR-5 fix)
// ---------------------------------------------------------------------------

interface RemoveConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

function RemoveConfirmDialog({ open, onOpenChange, onConfirm }: RemoveConfirmDialogProps) {
  const t = useTranslations('Workflow.credentials.removeConfirm');
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('description')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {t('confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Presentational — credential-rotation list for an offboarding workflow run.
 * WHO rotates WHAT WHERE; never the secret itself (vault URL is a pointer).
 * Rendered as a definition-style list (short action list — not a sortable data
 * grid, so it intentionally avoids the shadcn Table primitive per the
 * web-vite table-pattern guard).
 */
export function CredentialsTab({
  rows,
  isLoading,
  isError,
  onRetry,
  onAdd,
  onMarkRotated,
  onRemove,
  isMutating,
}: CredentialsTabProps) {
  const t = useTranslations('Workflow.credentials');
  const tWorkflows = useTranslations('Workflows.errors');
  const { labelVaultProvider, labelAccessType, labelStatus } = useLabelFns();
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  const handleRemoveRequest = useCallback((id: string) => setRemoveTarget(id), []);
  const handleRemoveConfirm = useCallback(() => {
    if (removeTarget) onRemove(removeTarget);
    setRemoveTarget(null);
  }, [removeTarget, onRemove]);
  const handleRemoveCancel = useCallback((open: boolean) => {
    if (!open) setRemoveTarget(null);
  }, []);

  return (
    <section className="space-y-4" data-testid="credentials-tab">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('tabName')}</h3>
        <Button size="sm" onClick={onAdd} data-testid="credential-add-trigger">
          <Plus className="size-4" /> {t('actions.add')}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2" data-testid="credentials-loading">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={`skel-${i}`} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : isError ? (
        <div
          className="flex flex-col items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-center"
          data-testid="credentials-error">
          <AlertCircle className="size-5 text-destructive" aria-hidden="true" />
          <p className="text-sm text-destructive">{tWorkflows('failedToLoadWorkflows')}</p>
          <Button size="sm" variant="outline" onClick={onRetry}>
            {tWorkflows('retry')}
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="credentials-empty">
          {t('empty')}
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.map(row => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 space-y-0.5">
                <p className="truncate font-medium">{row.label}</p>
                <p className="text-xs text-muted-foreground">
                  {labelVaultProvider(row.vaultProvider)} · {labelAccessType(row.accessType)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    STATUS_VARIANT[row.status as keyof typeof STATUS_VARIANT] ?? 'secondary'
                  }>
                  {labelStatus(row.status)}
                </Badge>
                {row.status === 'PENDING' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onMarkRotated(row.id)}
                    disabled={isMutating}>
                    {t('actions.markRotated')}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemoveRequest(row.id)}
                  disabled={isMutating}>
                  {t('actions.remove')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <RemoveConfirmDialog
        open={removeTarget !== null}
        onOpenChange={handleRemoveCancel}
        onConfirm={handleRemoveConfirm}
      />
    </section>
  );
}
