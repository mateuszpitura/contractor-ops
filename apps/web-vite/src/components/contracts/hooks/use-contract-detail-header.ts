import { useCallback, useState } from 'react';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useRouter } from '../../../i18n/navigation.js';
import { tKey } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { ContractAction } from '../actions.js';
import { getDetailContractActions } from '../actions.js';

const ROUTED_ELSEWHERE = new Set(['sendForSignature']);
const NOT_IMPLEMENTED = new Set(['addAmendment', 'uploadDocument']);

export function useContractDetailHeader(contractId: string, contractStatus: string) {
  const router = useRouter();
  const t = useTranslations('ContractDetail');
  const trpc = useTRPC();
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const terminateMutation = useResourceMutation(
    trpc.contract.transitionStatus.mutationOptions({}),
    {
      invalidate: [trpc.contract.pathFilter()],
      successMessage: t('actions.terminateSuccess'),
      errorMessage: t('actions.terminateError'),
      onClose: () => setTerminateOpen(false),
    },
  );

  const supersedeMutation = useResourceMutation(
    trpc.contract.transitionStatus.mutationOptions({}),
    {
      invalidate: [trpc.contract.pathFilter()],
      successMessage: t('actions.supersedeSuccess'),
      errorMessage: t('actions.supersedeError'),
    },
  );

  const deleteMutation = useResourceMutation(
    trpc.contract.delete.mutationOptions({
      onSuccess: () => {
        router.push('/contracts');
      },
    }),
    {
      invalidate: [trpc.contract.pathFilter()],
      successMessage: t('actions.deleteSuccess'),
      errorMessage: t('actions.deleteError'),
      onClose: () => setDeleteOpen(false),
    },
  );

  const isPending =
    terminateMutation.isPending || supersedeMutation.isPending || deleteMutation.isPending;

  const applicable = getDetailContractActions({
    id: contractId,
    status: contractStatus,
  });

  const menuActions = applicable.filter(a => !ROUTED_ELSEWHERE.has(a.key));

  const getActionLabel = useCallback((action: ContractAction) => tKey(t, action.labelKey), [t]);

  const dispatchMenuAction = useCallback(
    (action: ContractAction) => {
      if (NOT_IMPLEMENTED.has(action.key)) return;
      switch (action.key) {
        case 'edit':
          setEditOpen(true);
          return;
        case 'terminate':
          setTerminateOpen(true);
          return;
        case 'supersede':
          supersedeMutation.mutate({ id: contractId, targetStatus: 'SUPERSEDED' });
          return;
        case 'delete':
          setDeleteOpen(true);
          return;
        default:
          return;
      }
    },
    [contractId, supersedeMutation],
  );

  const confirmDelete = useCallback(() => {
    deleteMutation.mutate({ id: contractId });
  }, [contractId, deleteMutation]);

  const confirmTerminate = useCallback(() => {
    terminateMutation.mutate({ id: contractId, targetStatus: 'TERMINATED' });
  }, [contractId, terminateMutation]);

  const hasNonDestructive = menuActions.some(a => a.variant !== 'destructive');
  const hasDestructive = menuActions.some(a => a.variant === 'destructive');

  return {
    confirmDelete,
    confirmTerminate,
    deleteMutation,
    deleteOpen,
    dispatchMenuAction,
    editOpen,
    getActionLabel,
    hasDestructive,
    hasNonDestructive,
    isPending,
    menuActions,
    notImplemented: NOT_IMPLEMENTED,
    setDeleteOpen,
    setEditOpen,
    setTerminateOpen,
    terminateMutation,
    terminateOpen,
  } as const;
}
