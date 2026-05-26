import { useTaskCardTemplateUsers } from '../hooks/use-task-card-template-users.js';
import type { TaskCardContainerProps } from './task-card.js';
import { TaskCard } from './task-card.js';

// Decision: variant flag (`isFixedUserLoading`) computed from RHF form state
// (`form.watch('tasks.${index}.assigneeMode')`) crossed with the user-query
// loading state. The view consumes the flag as a prop and renders a skeleton
// placeholder inside `<FixedUserField>` instead of the user `<Select>` —
// avoiding flicker when the assignee mode is `FIXED_USER` while users load.
// View itself remains presentational; the cross-state decision lives here.
export function TaskCardContainer(props: TaskCardContainerProps) {
  const assigneeMode = props.form.watch(`tasks.${props.index}.assigneeMode`) ?? 'ROLE_BASED';
  const { users, usersQuery } = useTaskCardTemplateUsers(props.form, props.index);
  const isFixedUserLoading = assigneeMode === 'FIXED_USER' && usersQuery.isLoading;
  return (
    <TaskCard
      {...props}
      users={users}
      usersQuery={usersQuery}
      isFixedUserLoading={isFixedUserLoading}
    />
  );
}
