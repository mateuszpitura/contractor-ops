/**
 * Equipment return-approval banner — admin-facing CTA shown on the
 * equipment detail page when a contractor has submitted a return
 * request awaiting approval.
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
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { format } from 'date-fns';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { useReturnApprovalBanner } from './hooks/use-return-approval-banner.js';

interface ReturnRequest {
  id: string;
  contractorName: string;
  itemCount: number;
  targetPointName: string;
  createdAt: string;
}

interface ReturnApprovalBannerProps {
  returnRequest: ReturnRequest;
}

export function ReturnApprovalBanner({ returnRequest }: ReturnApprovalBannerProps) {
  const t = useTranslations('Equipment.return');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const { approve, reject, isApproving, isRejecting, isPending } = useReturnApprovalBanner();

  const handleApprove = useCallback(() => approve(returnRequest.id), [approve, returnRequest.id]);
  const handleReject = useCallback(() => {
    reject(returnRequest.id);
    setRejectDialogOpen(false);
  }, [reject, returnRequest.id]);
  const handleOpenReject = useCallback(() => setRejectDialogOpen(true), []);

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
              {isRejecting ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {t('reject')}
            </Button>
            <Button size="sm" onClick={handleApprove} disabled={isPending}>
              {isApproving ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> : null}
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
            <AlertDialogCancel disabled={isRejecting}>{t('cancelAction')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleReject} disabled={isRejecting}>
              {isRejecting ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {t('reject')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
