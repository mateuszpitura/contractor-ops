import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

interface UseChangeRequestDiffCardOptions {
  requestId: string;
  onApproved?: () => void;
  onRejected?: () => void;
}

export function useChangeRequestDiffCard({
  requestId,
  onApproved,
  onRejected,
}: UseChangeRequestDiffCardOptions) {
  const trpc = useTRPC();
  const t = useTranslations('Settings.changeRequest');
  const queryClient = useQueryClient();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState('');

  const approveMutation = useMutation(
    trpc.settings.reviewChangeRequest.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.approved'));
        onApproved?.();
        queryClient.invalidateQueries(trpc.settings.pathFilter());
      },
      onError: () => {
        toast.error(t('toast.approveFailed'));
      },
    }),
  );

  const rejectMutation = useMutation(
    trpc.settings.reviewChangeRequest.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.rejected'));
        setRejectDialogOpen(false);
        setRejectComment('');
        onRejected?.();
        queryClient.invalidateQueries(trpc.settings.pathFilter());
      },
      onError: () => {
        toast.error(t('toast.rejectFailed'));
      },
    }),
  );

  const handleApprove = () => {
    approveMutation.mutate({
      requestId,
      action: 'approve',
    });
  };

  const handleRejectConfirm = () => {
    rejectMutation.mutate({
      requestId,
      action: 'reject',
      comment: rejectComment || undefined,
    });
  };

  return {
    t,
    rejectDialogOpen,
    setRejectDialogOpen,
    rejectComment,
    setRejectComment,
    approveMutation,
    rejectMutation,
    handleApprove,
    handleRejectConfirm,
  } as const;
}
