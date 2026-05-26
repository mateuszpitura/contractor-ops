import { useLinearTaskConfig } from './hooks/use-linear-task-config.js';
import { LinearTaskConfigView } from './linear-task-config.js';

interface LinearTaskConfigProps {
  taskTemplateId: string;
}

export function LinearTaskConfig({ taskTemplateId }: LinearTaskConfigProps) {
  const { connection, isConnected, ...rest } = useLinearTaskConfig(taskTemplateId);
  if (!(connection && isConnected)) return null;
  return <LinearTaskConfigView {...rest} />;
}
