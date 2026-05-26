import { useTaskCardTemplateUsers } from '../hooks/use-task-card-template-users.js';
import type { TaskCardContainerProps } from './task-card.js';
import { TaskCard } from './task-card.js';

// Decision: toolbar host — cross-state flag (assigneeMode === 'FIXED_USER'
// AND usersQuery.isLoading) computed from RHF form watch + user-query loading.
// Lifting would duplicate the FixedUserField wrapper across variants.
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
