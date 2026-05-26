import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

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

  const toggleActiveMutation = useMutation(
    trpc.approval.updateChain.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.approval.listChains.queryKey(),
        });
        toast.success(toasts.done());
      },
      onError: () => {
        toast.error(t('approvals.toasts.saveFailed'));
        queryClient.invalidateQueries({
          queryKey: trpc.approval.listChains.queryKey(),
        });
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.approval.deleteChain.mutationOptions({
      onSuccess: () => {
        toast.success(t('approvals.toasts.deleted'));
        queryClient.invalidateQueries({
          queryKey: trpc.approval.listChains.queryKey(),
        });
        setDeletingChainId(null);
      },
      onError: () => {
        toast.error(t('approvals.toasts.deleteFailed'));
      },
    }),
  );

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
