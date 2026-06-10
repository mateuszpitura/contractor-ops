import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
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
  const t = useTranslations('Integrations');

  const listQuery = useQuery({
    ...trpc.docs.list.queryOptions({ workflowTaskRunId }),
  });

  const listQueryKey = trpc.docs.list.queryKey({ workflowTaskRunId });

  const detachMutation = useResourceMutation(trpc.docs.detach.mutationOptions(), {
    invalidate: [listQueryKey],
    successMessage: t('docs.section.toast.removed'),
    errorMessage: t('docs.section.toast.removeFailed'),
  });

  const refreshMutation = useResourceMutation(
    trpc.docs.refreshMetadata.mutationOptions({
      onSettled: () => {
        setRefreshingId(null);
      },
    }),
    {
      invalidate: [listQueryKey],
      successMessage: t('docs.section.toast.refreshed'),
      errorMessage: t('docs.section.toast.refreshFailed'),
    },
  );

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
