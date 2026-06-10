import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useResourceMutation } from '../../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';
import type { WorkflowRoleFormInput } from '../workflow-role-form-dialog.js';

export function useWorkflowRolesTable() {
  const trpc = useTRPC();
  const t = useTranslations('WorkflowRoles');
  const listQuery = useQuery(trpc.workflowRoles.list.queryOptions());

  const [editing, setEditing] = useState<WorkflowRoleFormInput | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

  const deleteMutation = useResourceMutation(
    trpc.workflowRoles.delete.mutationOptions({
      onSuccess: () => {
        setDeleting(null);
      },
    }),
    {
      invalidate: [trpc.workflowRoles.pathFilter()],
      successMessage: t('toast.deleted'),
    },
  );

  const rows = listQuery.data ?? [];
  const showFeaturedEmpty = !(listQuery.isLoading || listQuery.isFetching) && rows.length === 0;

  return {
    t,
    listQuery,
    rows,
    showFeaturedEmpty,
    editing,
    setEditing,
    deleting,
    setDeleting,
    deleteMutation,
  } as const;
}
