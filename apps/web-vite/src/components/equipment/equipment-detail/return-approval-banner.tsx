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
import { format } from 'date-fns';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { useEquipmentReturnApproval } from '../hooks/use-equipment-detail-actions.js';

interface ReturnRequest {
  id: string;
  contractorName: string;
  itemCount: number;
  targetPointName: string;
  createdAt: string;
}

export interface ReturnApprovalBannerProps {
  returnRequest: ReturnRequest;
}

type ReturnApprovalBannerViewProps = ReturnApprovalBannerProps &
  ReturnType<typeof useEquipmentReturnApproval>;

export function ReturnApprovalBannerView({
  returnRequest,
  approveMutation,
  rejectMutation,
}: ReturnApprovalBannerViewProps) {
  const t = useTranslations('Equipment.return');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  const isPending = approveMutation.isPending || rejectMutation.isPending;

  const handleOpenReject = useCallback(() => setRejectDialogOpen(true), []);
  const handleApprove = useCallback(() => {
    approveMutation.mutate({ id: returnRequest.id, parcelSize: 'large' });
  }, [approveMutation, returnRequest.id]);
  const handleConfirmReject = useCallback(() => {
    rejectMutation.mutate(
      { id: returnRequest.id },
      { onSuccess: () => setRejectDialogOpen(false) },
    );
  }, [rejectMutation, returnRequest.id]);

  return (
    <>
      <div className="rounded-md border-s-4 border-warning bg-warning/10 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {t('requestedBy', { name: returnRequest.contractorName })}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('itemCount', { count: returnRequest.itemCount })} | {t('dropOff')}:{' '}
              {returnRequest.targetPointName} | {t('requested')}:{' '}
              {format(new Date(returnRequest.createdAt), 'MMM d, yyyy')}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="destructive" size="sm" onClick={handleOpenReject} disabled={isPending}>
              {!!rejectMutation.isPending && (
                <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              {t('reject')}
            </Button>
            <Button size="sm" onClick={handleApprove} disabled={isPending}>
              {!!approveMutation.isPending && (
                <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              {t('approve')}
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('rejectConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('rejectConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rejectMutation.isPending}>
              {t('cancelAction')}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={rejectMutation.isPending}>
              {!!rejectMutation.isPending && (
                <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              {t('reject')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
