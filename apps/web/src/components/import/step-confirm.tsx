'use client';

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Progress } from '@contractor-ops/ui/components/shadcn/progress';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import type { CommitResult, EntityType } from './import-wizard-dialog';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface StepConfirmProps {
  entityType: EntityType;
  counts: {
    newRecords: number;
    updates: number;
    skippedDuplicates: number;
    skippedErrors: number;
  };
  onImport: () => Promise<void>;
  importResult: CommitResult | null;
  isImporting: boolean;
}

export function StepConfirm({
  entityType,
  counts,
  onImport,
  importResult,
  isImporting,
}: StepConfirmProps) {
  const t = useTranslations('Import');
  const router = useRouter();
  const [hasError, setHasError] = useState(false);

  const totalToImport = counts.newRecords + counts.updates;
  const entityLabel =
    entityType === 'contractor' ? t('confirm.contractors') : t('confirm.contracts');

  const handleImport = async () => {
    setHasError(false);
    try {
      await onImport();
    } catch {
      setHasError(true);
    }
  };

  // ---------------------------------------------------------------------------
  // Completion state
  // ---------------------------------------------------------------------------
  if (importResult) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <CheckCircle2 className="size-12 text-emerald-600" />
        <h3 className="mt-4 text-xl font-semibold">{t('confirm.complete')}</h3>
        <div className="mt-4 space-y-1 text-sm text-muted-foreground">
          <p>{t('confirm.created', { count: importResult.created })}</p>
          <p>{t('confirm.updated', { count: importResult.updated })}</p>
          <p>{t('confirm.skipped', { count: importResult.skipped })}</p>
          {importResult.failed > 0 && (
            <p className="text-destructive">
              {t('confirm.failed', { count: importResult.failed })}
            </p>
          )}
        </div>
        <Button
          className="mt-6"
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={() => router.push(entityType === 'contractor' ? '/contractors' : '/contracts')}
          type="button">
          {t('confirm.viewEntities', { entities: entityLabel })}
        </Button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Importing state
  // ---------------------------------------------------------------------------
  if (isImporting) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">{t('confirm.importing')}</p>
        <Progress value={50} className="mt-4 w-64" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <AlertCircle className="size-12 text-destructive" />
        <h3 className="mt-4 text-lg font-semibold">{t('confirm.errorTitle')}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{t('confirm.errorDescription')}</p>
        {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
        <Button className="mt-6" onClick={handleImport} type="button">
          {t('confirm.tryAgain')}
        </Button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Pre-import state
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <h3 className="text-lg font-semibold">
        {t('confirm.ready', { count: totalToImport, entities: entityLabel })}
      </h3>

      <div className="mt-6 w-full max-w-xs space-y-3 text-start">
        <div className="flex items-center justify-between rounded-md bg-muted/50 px-4 py-2 text-sm">
          <span>{t('confirm.newRecordsLabel')}</span>
          <span className="font-semibold">{counts.newRecords}</span>
        </div>
        <div className="flex items-center justify-between rounded-md bg-muted/50 px-4 py-2 text-sm">
          <span>{t('confirm.updatesLabel')}</span>
          <span className="font-semibold">{counts.updates}</span>
        </div>
        <div className="flex items-center justify-between rounded-md bg-muted/50 px-4 py-2 text-sm">
          <span>{t('confirm.skippedDuplicatesLabel')}</span>
          <span className="font-semibold">{counts.skippedDuplicates}</span>
        </div>
        <div className="flex items-center justify-between rounded-md bg-muted/50 px-4 py-2 text-sm">
          <span>{t('confirm.skippedErrorsLabel')}</span>
          <span className="font-semibold">{counts.skippedErrors}</span>
        </div>
      </div>

      {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
      <Button className="mt-8" onClick={handleImport} type="button">
        {t('confirm.importButton', { count: totalToImport })}
      </Button>
    </div>
  );
}
