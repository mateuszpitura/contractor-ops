import { useApprovalActions } from '../../../hooks/use-approval-actions.js';
import type { ApprovalSidePanelProps } from './side-panel.js';
import { ApprovalSidePanelView } from './side-panel.js';

type ApprovalSidePanelContainerProps = Omit<ApprovalSidePanelProps, 'actions' | 'step'> & {
  step: ApprovalSidePanelProps['step'] | null;
};

export function ApprovalSidePanelContainer({
  step,
  open,
  onOpenChange,
  resolvedChain,
}: ApprovalSidePanelContainerProps) {
  if (!step) return null;
  return (
    <ApprovalSidePanelBoundContainer
      step={step}
      open={open}
      onOpenChange={onOpenChange}
      resolvedChain={resolvedChain}
    />
  );
}

type BoundContainerProps = Omit<ApprovalSidePanelProps, 'actions'>;

function ApprovalSidePanelBoundContainer({
  step,
  open,
  onOpenChange,
  resolvedChain,
}: BoundContainerProps) {
  const actions = useApprovalActions(step.id, () => {
    onOpenChange(false);
  });

  return (
    <ApprovalSidePanelView
      step={step}
      open={open}
      onOpenChange={onOpenChange}
      resolvedChain={resolvedChain}
      actions={actions}
    />
  );
}
