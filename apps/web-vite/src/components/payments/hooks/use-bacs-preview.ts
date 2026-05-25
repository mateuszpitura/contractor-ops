import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

interface BacsPreviewData {
  fileText: string;
  transliterationWarnings?: unknown[];
  modulusWarnings?: unknown[];
}

export function useBacsPreview(paymentRunId: string) {
  const t = useTranslations('Payments.bacs');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [previewVisible, setPreviewVisible] = useState(false);

  const previewQuery = useQuery({
    ...trpc.bacs.previewExport.queryOptions({ paymentRunId }),
    enabled: previewVisible,
    retry: false,
  });

  const generateMutation = useMutation(
    trpc.bacs.generateExport.mutationOptions({
      onSuccess: data => {
        if (typeof window !== 'undefined') {
          window.open(data.downloadUrl, '_blank', 'noopener,noreferrer');
        }
        toast.success(`${t('downloadAction')} — ${data.filename}`);
        queryClient.invalidateQueries(trpc.bacs.pathFilter());
      },
      onError: err => {
        toast.error(err?.message || t('generateFailure'));
      },
    }),
  );

  const previewError = previewQuery.error;
  const submitterNotConfigured =
    previewError instanceof TRPCClientError &&
    previewError.data?.code === 'PRECONDITION_FAILED' &&
    typeof previewError.message === 'string' &&
    /not configured/i.test(previewError.message);

  const handleShowPreview = useCallback(() => {
    setPreviewVisible(true);
  }, []);

  const handleGenerate = useCallback(() => {
    generateMutation.mutate({ paymentRunId });
  }, [generateMutation, paymentRunId]);

  const previewData = previewQuery.data as BacsPreviewData | undefined;

  return {
    previewVisible,
    onShowPreview: handleShowPreview,
    isPreviewFetching: previewQuery.isFetching,
    previewData,
    previewError: previewError && !submitterNotConfigured ? previewError : null,
    submitterNotConfigured,
    onGenerate: handleGenerate,
    isGenerating: generateMutation.isPending,
  } as const;
}
