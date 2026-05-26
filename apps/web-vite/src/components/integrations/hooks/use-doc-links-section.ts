import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export interface DocLink {
  id: string;
  externalUrl: string;
  externalType: string;
  metadataJson: {
    title?: string;
    lastEditedTime?: string;
    [key: string]: unknown;
  } | null;
}

export interface UseDocLinksSectionParams {
  workflowTaskRunId: string;
  readOnly?: boolean;
}

export function useDocLinksSection({ workflowTaskRunId, readOnly }: UseDocLinksSectionParams) {
  const trpc = useTRPC();
  const [attachOpen, setAttachOpen] = useState(false);
  const [pendingDetachId, setPendingDetachId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const t = useTranslations('Integrations');

  const listQuery = useQuery({
    ...trpc.docs.list.queryOptions({ workflowTaskRunId }),
  });

  const detachMutation = useMutation({
    ...trpc.docs.detach.mutationOptions(),
    onSuccess: () => {
      toast.success(t('docs.section.toast.removed'));
      void queryClient.invalidateQueries({
        queryKey: trpc.docs.list.queryKey({ workflowTaskRunId }),
      });
    },
    onError: () => {
      toast.error(t('docs.section.toast.removeFailed'));
    },
  });

  const refreshMutation = useMutation({
    ...trpc.docs.refreshMetadata.mutationOptions(),
    onSuccess: () => {
      toast.success(t('docs.section.toast.refreshed'));
      void queryClient.invalidateQueries({
        queryKey: trpc.docs.list.queryKey({ workflowTaskRunId }),
      });
    },
    onError: err => {
      toast.error(err.message || t('docs.section.toast.refreshFailed'));
    },
    onSettled: () => {
      setRefreshingId(null);
    },
  });

  const handleRefresh = useCallback(
    (externalLinkId: string) => {
      setRefreshingId(externalLinkId);
      refreshMutation.mutate({ externalLinkId });
    },
    [refreshMutation],
  );

  const handleRemove = useCallback((externalLinkId: string) => {
    setPendingDetachId(externalLinkId);
  }, []);

  const confirmRemove = useCallback(() => {
    if (pendingDetachId) {
      detachMutation.mutate({ externalLinkId: pendingDetachId });
      setPendingDetachId(null);
    }
  }, [detachMutation, pendingDetachId]);

  const openAttachDialog = useCallback(() => {
    setAttachOpen(true);
  }, []);

  const docLinks = useMemo(() => (listQuery.data ?? []) as DocLink[], [listQuery.data]);

  return {
    readOnly,
    workflowTaskRunId,
    attachOpen,
    setAttachOpen,
    pendingDetachId,
    setPendingDetachId,
    listQuery,
    detachMutation,
    refreshMutation,
    handleRefresh,
    handleRemove,
    confirmRemove,
    openAttachDialog,
    docLinks,
    refreshingId,
    t,
  } as const;
}
