import { CalendarTaskConfigSkeleton, CalendarTaskConfigView } from './calendar-task-config.js';
import { useCalendarTaskConfig } from './hooks/use-calendar-task-config.js';

interface CalendarTaskConfigProps {
  taskTemplateId: string;
}

export function CalendarTaskConfig({ taskTemplateId }: CalendarTaskConfigProps) {
  const { configQuery, ...viewProps } = useCalendarTaskConfig(taskTemplateId);
  if (configQuery.isLoading) return <CalendarTaskConfigSkeleton />;
  return <CalendarTaskConfigView {...viewProps} />;
}
