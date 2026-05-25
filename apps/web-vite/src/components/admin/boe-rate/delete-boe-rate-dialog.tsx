/**
 * Delete BoE rate dialog. Step 10 batch port from
 * apps/web/src/components/admin/boe-rate/delete-boe-rate-dialog.tsx:
 *   - `'use client'` stripped
 *   - `next-intl#useTranslations` → `../../../i18n/useTranslations.js`
 *   - `@/trpc/init` → `useTRPC()` proxy
 */

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
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { BoeRateEntry, useBoeRateDelete } from '../hooks/use-admin-boe-rate.js';

interface DeleteBoeRateDialogProps {
  entry: BoeRateEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deleteMutation: ReturnType<typeof useBoeRateDelete>;
}

export function DeleteBoeRateDialog({
  entry,
  open,
  onOpenChange,
  deleteMutation,
}: DeleteBoeRateDialogProps) {
  const t = useTranslations('Admin.BoeRate');
  const tCommon = useTranslations('Common');

  const effectiveDate = new Date(entry.effectiveFrom).toISOString().slice(0, 10);
  const rate = Number(entry.ratePercent).toFixed(2);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('deleteDialogTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('deleteDialogBodyDynamic', { date: effectiveDate, rate })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => deleteMutation.mutate({ id: entry.id })}
            disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? t('deleting') : t('deleteRate')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
