import { useWorkflowSidePanelRun } from './hooks/use-workflow-ui.js';
import type { WorkflowSidePanelRun } from './workflow-side-panel.js';
import {
  WorkflowSidePanelContent,
  WorkflowSidePanelError,
  WorkflowSidePanelShell,
  WorkflowSidePanelSkeleton,
} from './workflow-side-panel.js';

interface WorkflowSidePanelContainerProps {
  runId: string | null;
  onClose: () => void;
}

export function WorkflowSidePanelContainer({ runId, onClose }: WorkflowSidePanelContainerProps) {
  const { run, handleRetry, isError, isLoading } = useWorkflowSidePanelRun(runId);

  const open = runId !== null;

  let body: React.ReactNode = null;
  if (isLoading) {
    body = <WorkflowSidePanelSkeleton />;
  } else if (isError) {
    body = <WorkflowSidePanelError onRetry={handleRetry} />;
  } else if (run) {
    body = <WorkflowSidePanelContent run={run as WorkflowSidePanelRun} />;
  }

  return (
    <WorkflowSidePanelShell open={open} onClose={onClose}>
      {body}
    </WorkflowSidePanelShell>
  );
}
