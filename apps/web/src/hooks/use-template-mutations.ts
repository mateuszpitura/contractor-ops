import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { trpc } from '@/trpc/init';

/**
 * Encapsulates workflow template CRUD mutations with cache invalidation.
 */
export function useTemplateMutations(t: (key: string) => string): {
  activate: (id: string) => void;
  archive: (id: string) => void;
  duplicate: (id: string) => void;
  deleteTemplate: (id: string) => void;
  isPending: boolean;
} {
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: [['workflow', 'listTemplates']],
    });
  }, [queryClient]);

  const updateMutation = useMutation(
    trpc.workflow.updateTemplate.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success('Done.');
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.workflow.deleteTemplate.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success('Done.');
      },
    }),
  );

  const duplicateMutation = useMutation(
    trpc.workflow.duplicateTemplate.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success('Done.');
      },
    }),
  );

  const activate = useCallback(
    async (id: string) => {
      try {
        await updateMutation.mutateAsync({ id, status: 'ACTIVE' });
        toast.success(t('toast.templateActivated'));
        invalidate();
      } catch {
        toast.error(t('errors.failedToSaveTemplate'));
      }
    },
    [updateMutation, invalidate, t],
  );

  const archive = useCallback(
    async (id: string) => {
      try {
        await updateMutation.mutateAsync({ id, status: 'ARCHIVED' });
        toast.success(t('toast.templateArchived'));
        invalidate();
      } catch {
        toast.error(t('errors.failedToSaveTemplate'));
      }
    },
    [updateMutation, invalidate, t],
  );

  const duplicate = useCallback(
    async (id: string) => {
      try {
        await duplicateMutation.mutateAsync({ id });
        toast.success(t('toast.templateDuplicated'));
        invalidate();
      } catch {
        toast.error(t('errors.failedToSaveTemplate'));
      }
    },
    [duplicateMutation, invalidate, t],
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      try {
        await deleteMutation.mutateAsync({ id });
        toast.success(t('toast.templateDeleted'));
        invalidate();
      } catch {
        toast.error(t('errors.failedToSaveTemplate'));
      }
    },
    [deleteMutation, invalidate, t],
  );

  const isPending =
    updateMutation.isPending || deleteMutation.isPending || duplicateMutation.isPending;

  return { activate, archive, duplicate, deleteTemplate, isPending };
}
