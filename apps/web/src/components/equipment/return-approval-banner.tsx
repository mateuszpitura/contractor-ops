'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Admin-facing banner displayed at the top of the equipment detail page
 * when a contractor has submitted a return request pending approval.
 */
export function ReturnApprovalBanner({ returnRequest }: ReturnApprovalBannerProps) {
  const t = useTranslations('Equipment.return');
  const queryClient = useQueryClient();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  const approveMutation = useMutation(
    trpc.equipment.approveReturnRequest.mutationOptions({
      onSuccess: () => {
        toast.success(t('approvedToast'));
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.getById.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.listReturnRequests.queryKey(),
        });
      },
      onError: () => {
        toast.error(t('actionFailed'));
      },
    }),
  );

  const rejectMutation = useMutation(
    trpc.equipment.rejectReturnRequest.mutationOptions({
      onSuccess: () => {
        toast.success(t('rejectedToast'));
        setRejectDialogOpen(false);
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.getById.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.listReturnRequests.queryKey(),
        });
      },
      onError: () => {
        toast.error(t('actionFailed'));
      },
    }),
  );

  const handleApprove = () => {
    approveMutation.mutate({
      id: returnRequest.id,
      parcelSize: 'large',
    });
  };

  const handleReject = () => {
    rejectMutation.mutate({ id: returnRequest.id });
  };

  const isPending = approveMutation.isPending || rejectMutation.isPending;

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
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setRejectDialogOpen(true)}
              disabled={isPending}>
              {rejectMutation.isPending && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
              {t('reject')}
            </Button>
            <Button size="sm" onClick={handleApprove} disabled={isPending}>
              {approveMutation.isPending && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
              {t('approve')}
            </Button>
          </div>
        </div>
      </div>

      {/* Reject confirmation dialog */}
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
              onClick={handleReject}
              disabled={rejectMutation.isPending}>
              {rejectMutation.isPending && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
              {t('reject')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
