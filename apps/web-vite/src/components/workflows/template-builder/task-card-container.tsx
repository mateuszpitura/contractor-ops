import { useTaskCardTemplateUsers } from '../hooks/use-task-card-template-users.js';
import type { TaskCardContainerProps } from './task-card.js';
import { TaskCard } from './task-card.js';

export function TaskCardContainer(props: TaskCardContainerProps) {
  const { users, usersQuery } = useTaskCardTemplateUsers(props.form, props.index);
  return <TaskCard {...props} users={users} usersQuery={usersQuery} />;
}
