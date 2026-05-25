import { useMyTasksList } from './hooks/use-my-tasks-list.js';
import { MyTasksList } from './my-tasks-list.js';

export function MyTasksListContainer() {
  const list = useMyTasksList();
  return <MyTasksList {...list} />;
}
