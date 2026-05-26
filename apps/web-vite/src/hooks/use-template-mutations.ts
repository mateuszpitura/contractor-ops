/**
 * Workflow template CRUD mutations. Step 11 codemod port from
 * apps/web/src/hooks/use-template-mutations.ts:
 *   - `@/trpc/init`           → `../providers/trpc-provider.js#useTRPC`
 *   - `@/i18n/typed-keys`     → `../i18n/typed-keys.js`
 */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import type { LooseTranslator } from '../i18n/typed-keys.js';
import { useCommonToasts } from '../i18n/use-common-toasts.js';
import { useTRPC } from '../providers/trpc-provider.js';
import { useResourceMutation } from './use-resource-mutation.js';

export function useTemplateMutations(t: LooseTranslator): {
  activate: (id: string) => void;
  archive: (id: string) => void;
  duplicate: (id: string) => void;
  deleteTemplate: (id: string) => void;
  isPending: boolean;
} {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const toasts = useCommonToasts();

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [['workflow', 'listTemplates']] });
  }, [queryClient]);

  const updateMutation = useResourceMutation(
    trpc.workflow.updateTemplate.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.workflow.pathFilter());
      },
    }),
    { successMessage: toasts.done() },
  );

  const deleteMutation = useResourceMutation(
    trpc.workflow.deleteTemplate.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.workflow.pathFilter());
      },
    }),
    { successMessage: toasts.done() },
  );

  const duplicateMutation = useResourceMutation(
    trpc.workflow.duplicateTemplate.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.workflow.pathFilter());
      },
    }),
    { successMessage: toasts.done() },
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
