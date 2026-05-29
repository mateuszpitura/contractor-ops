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
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Download, Loader2, Trash2 } from 'lucide-react';
import { useCallback } from 'react';
import type { useGdprDataRightsSection } from './hooks/use-gdpr-data-rights-section.js';
import { GDPR_CONFIRM_PHRASE } from './hooks/use-gdpr-data-rights-section.js';

export type GdprDataRightsSectionProps = ReturnType<typeof useGdprDataRightsSection>;

export function GdprDataRightsSection({
  t,
  erasureOpen,
  setErasureOpen,
  confirmInput,
  setConfirmInput,
  retainFinancial,
  setRetainFinancial,
  exportPending,
  handleExport,
  handleErasureConfirm,
  isErasurePending,
}: GdprDataRightsSectionProps) {
  const handleOpenErasure = useCallback(() => setErasureOpen(true), [setErasureOpen]);
  const handleConfirmInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setConfirmInput(e.target.value),
    [setConfirmInput],
  );
  const handleRetainFinancialChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setRetainFinancial(e.target.checked),
    [setRetainFinancial],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-sm font-medium">{t('export.title')}</p>
          <p className="text-sm text-muted-foreground">{t('export.body')}</p>
          <div>
            <Button variant="outline" onClick={handleExport} disabled={exportPending}>
              {exportPending ? (
                <Loader2 className="me-1.5 size-3.5 animate-spin" />
              ) : (
                <Download className="me-1.5 size-3.5" />
              )}
              {t('export.cta')}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 p-4">
          <p className="text-sm font-medium text-destructive">{t('erasure.title')}</p>
          <p className="text-sm text-muted-foreground">{t('erasure.body')}</p>
          <div>
            <Button variant="destructive" onClick={handleOpenErasure}>
              <Trash2 className="me-1.5 size-3.5" />
              {t('erasure.cta')}
            </Button>
          </div>
        </div>
      </CardContent>

      <AlertDialog open={erasureOpen} onOpenChange={setErasureOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4" />
              {t('erasure.confirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('erasure.confirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="erasure-confirm">
                {t('erasure.typePhrase', { phrase: GDPR_CONFIRM_PHRASE })}
              </Label>
              <Input
                id="erasure-confirm"
                value={confirmInput}
                onChange={handleConfirmInputChange}
                placeholder={GDPR_CONFIRM_PHRASE}
                autoComplete="off"
              />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={retainFinancial}
                onChange={handleRetainFinancialChange}
              />
              <span>{t('erasure.retainFinancialLabel')}</span>
            </label>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>{t('erasure.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={confirmInput !== GDPR_CONFIRM_PHRASE || isErasurePending}
              onClick={handleErasureConfirm}>
              {isErasurePending && <Loader2 className="me-1.5 size-3.5 animate-spin" />}
              {t('erasure.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
