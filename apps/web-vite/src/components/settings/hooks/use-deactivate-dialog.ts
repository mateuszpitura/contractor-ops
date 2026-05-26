import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

interface UseDeactivateDialogOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

export function useDeactivateDialog({
  onOpenChange,
  userId,
  userName,
}: UseDeactivateDialogOptions) {
  const trpc = useTRPC();
  const t = useTranslations('Users.deactivateDialog');
  const tToast = useTranslations('Settings.toast');
  const queryClient = useQueryClient();

  const deactivateMutation = useMutation(
    trpc.user.deactivate.mutationOptions({
      onSuccess: () => {
        toast.success(t('successToast', { userName }));
        queryClient.invalidateQueries({ queryKey: trpc.user.list.queryKey() });
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        const message =
          typeof error === 'object' && error && 'message' in error
            ? String((error as { message?: unknown }).message ?? '')
            : '';
        toast.error(message || tToast('deactivateFailed'));
      },
    }),
  );

  const handleConfirm = () => {
    deactivateMutation.mutate({ userId });
  };

  return {
    t,
    isPending: deactivateMutation.isPending,
    handleConfirm,
  } as const;
}
