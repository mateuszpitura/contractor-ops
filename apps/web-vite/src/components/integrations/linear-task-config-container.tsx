import { useLinearTaskConfig } from './hooks/use-linear-task-config.js';
import { LinearTaskConfigView } from './linear-task-config.js';

interface LinearTaskConfigProps {
  taskTemplateId: string;
}

/**
 * Decisive: connection gate — renders nothing unless the org has a connected
 * (or pending-mapping) Linear integration. The view is presentational and
 * never owns the gate.
 */
export function LinearTaskConfig({ taskTemplateId }: LinearTaskConfigProps) {
  const { connection, isConnected, ...rest } = useLinearTaskConfig(taskTemplateId);
  if (!(connection && isConnected)) return null;
  return <LinearTaskConfigView {...rest} />;
}
