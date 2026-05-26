import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';
import type { WorkflowRoleFormInput } from '../workflow-role-form-dialog.js';

export function useWorkflowRolesTable() {
  const trpc = useTRPC();
  const t = useTranslations('WorkflowRoles');
  const queryClient = useQueryClient();
  const listQuery = useQuery(trpc.workflowRoles.list.queryOptions());

  const [editing, setEditing] = useState<WorkflowRoleFormInput | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

  const deleteMutation = useMutation(
    trpc.workflowRoles.delete.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.deleted'));
        queryClient.invalidateQueries(trpc.workflowRoles.pathFilter());
        setDeleting(null);
      },
      onError: (err: { message: string }) => toast.error(err.message),
    }),
  );

  return {
    t,
    listQuery,
    rows: listQuery.data ?? [],
    editing,
    setEditing,
    deleting,
    setDeleting,
    deleteMutation,
  } as const;
}
