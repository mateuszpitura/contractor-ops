import { useMyTasksList } from './hooks/use-my-tasks-list.js';
import {
  MyTasksListBody,
  MyTasksListEmpty,
  MyTasksListError,
  MyTasksListSkeleton,
} from './my-tasks-list.js';

interface MyTasksListContainerProps {
  onStartWorkflow?: () => void;
}

export function MyTasksListContainer({ onStartWorkflow }: MyTasksListContainerProps) {
  const { tasks, isLoading, isError, handleRetry, overdueOnly, setOverdueOnly } = useMyTasksList();

  if (isError) return <MyTasksListError onRetry={handleRetry} />;
  if (isLoading) return <MyTasksListSkeleton />;
  if (tasks.length === 0 && !overdueOnly) {
    return <MyTasksListEmpty onStartWorkflow={onStartWorkflow} />;
  }
  return (
    <MyTasksListBody tasks={tasks} overdueOnly={overdueOnly} setOverdueOnly={setOverdueOnly} />
  );
}
