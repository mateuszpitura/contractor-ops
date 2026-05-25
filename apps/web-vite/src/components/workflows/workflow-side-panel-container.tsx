import { useWorkflowSidePanelRun } from './hooks/use-workflow-ui.js';
import { WorkflowSidePanelView } from './workflow-side-panel.js';

interface WorkflowSidePanelContainerProps {
  runId: string | null;
  onClose: () => void;
}

export function WorkflowSidePanelContainer({ runId, onClose }: WorkflowSidePanelContainerProps) {
  const { run, handleRetry, isError, isLoading } = useWorkflowSidePanelRun(runId);

  return (
    <WorkflowSidePanelView
      runId={runId}
      run={run as Parameters<typeof WorkflowSidePanelView>[0]['run']}
      isLoading={isLoading}
      isError={isError}
      handleRetry={handleRetry}
      onClose={onClose}
    />
  );
}
