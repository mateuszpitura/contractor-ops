import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useRouter } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export const GDPR_CONFIRM_PHRASE = 'DELETE ALL DATA';

export function useGdprDataRightsSection() {
  const trpc = useTRPC();
  const t = useTranslations('Settings.gdpr');
  const queryClient = useQueryClient();
  const router = useRouter();

  const [erasureOpen, setErasureOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [retainFinancial, setRetainFinancial] = useState(true);
  const [exportPending, setExportPending] = useState(false);

  const handleExport = useCallback(async () => {
    setExportPending(true);
    try {
      const data = await queryClient.fetchQuery(trpc.gdpr.exportData.queryOptions());
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `org-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('toast.exportReady'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.exportFailed'));
    } finally {
      setExportPending(false);
    }
  }, [queryClient, trpc.gdpr, t]);

  const erasureMutation = useMutation(
    trpc.gdpr.requestErasure.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.erasureRequested'));
        setErasureOpen(false);
        setConfirmInput('');
        queryClient.clear();
        router.push('/login');
      },
      onError: err => toast.error(err.message || t('toast.erasureFailed')),
    }),
  );

  const handleErasureConfirm = useCallback(() => {
    erasureMutation.mutate({
      confirmPhrase: confirmInput,
      retainFinancialRecords: retainFinancial,
    });
  }, [confirmInput, retainFinancial, erasureMutation]);

  return {
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
    isErasurePending: erasureMutation.isPending,
  } as const;
}
