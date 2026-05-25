import type { UseFormReturn } from 'react-hook-form';

import type { TemplateFormValues } from '../template-builder/use-template-form.js';
import { useWorkflowTemplateBuilderUsers } from './use-workflow-ui.js';

export interface TaskCardTemplateUser {
  id: string;
  name?: string | null;
  email?: string | null;
}

/**
 * Hook used by the template-builder TaskCardContainer:
 *  - reads the current `assigneeMode` from the form
 *  - lazily fetches the user list only when the task is set to FIXED_USER
 *  - returns a presentational-friendly props bag
 */
export function useTaskCardTemplateUsers(form: UseFormReturn<TemplateFormValues>, index: number) {
  const assigneeMode = form.watch(`tasks.${index}.assigneeMode`) ?? 'ROLE_BASED';
  const usersQuery = useWorkflowTemplateBuilderUsers(assigneeMode === 'FIXED_USER');
  const users = (usersQuery.data ?? []) as TaskCardTemplateUser[];

  return {
    users,
    usersQuery: { isLoading: usersQuery.isLoading },
  } as const;
}
