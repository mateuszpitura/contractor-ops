import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { ChainData } from '../chain-editor-dialog.js';

export function useApprovalChainsTab() {
  const trpc = useTRPC();
  const t = useTranslations('Settings');
  const tAria = useTranslations('Common.aria');
  const queryClient = useQueryClient();
  const toasts = useCommonToasts();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingChain, setEditingChain] = useState<ChainData | null>(null);
  const [deletingChainId, setDeletingChainId] = useState<string | null>(null);

  const chainsQuery = useQuery(trpc.approval.listChains.queryOptions());
  const chains = chainsQuery.data ?? [];

  const toggleActiveMutation = useResourceMutation(
    trpc.approval.updateChain.mutationOptions({
      onError: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.approval.listChains.queryKey(),
        });
      },
    }),
    {
      invalidate: [trpc.approval.listChains.queryKey()],
      successMessage: toasts.done(),
      errorMessage: t('approvals.toasts.saveFailed'),
    },
  );

  const deleteMutation = useResourceMutation(trpc.approval.deleteChain.mutationOptions(), {
    invalidate: [trpc.approval.listChains.queryKey()],
    successMessage: t('approvals.toasts.deleted'),
    errorMessage: t('approvals.toasts.deleteFailed'),
    onClose: () => setDeletingChainId(null),
  });

  const handleToggleActive = (chain: (typeof chains)[number]) => {
    toggleActiveMutation.mutate({
      id: chain.id,
      name: chain.name,
      isDefault: chain.isDefault,
      stepsJson: chain.stepsJson as Parameters<typeof toggleActiveMutation.mutate>[0]['stepsJson'],
      isActive: !chain.isActive,
    });
  };

  const handleEdit = (chain: (typeof chains)[number]) => {
    setEditingChain({
      id: chain.id,
      name: chain.name,
      isDefault: chain.isDefault,
      isActive: chain.isActive,
      conditionsJson: chain.conditionsJson,
      stepsJson: chain.stepsJson,
    } as ChainData);
    setEditorOpen(true);
  };

  const handleCreate = () => {
    setEditingChain(null);
    setEditorOpen(true);
  };

  const handleDelete = (chainId: string) => {
    deleteMutation.mutate({ id: chainId });
  };

  return {
    t,
    tAria,
    chainsQuery,
    chains,
    editorOpen,
    setEditorOpen,
    editingChain,
    deletingChainId,
    setDeletingChainId,
    toggleActiveMutation,
    deleteMutation,
    handleToggleActive,
    handleEdit,
    handleCreate,
    handleDelete,
  } as const;
}
