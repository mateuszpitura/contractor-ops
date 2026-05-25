import { useContractorTabWorkflows } from '../hooks/use-contractor-tab-workflows.js';
import { WorkflowsTabEmpty, WorkflowsTabSkeleton, WorkflowsTabView } from './workflows-tab.js';

type WorkflowsTabContainerProps = {
  contractorId: string;
};

export function WorkflowsTabContainer({ contractorId }: WorkflowsTabContainerProps) {
  const workflows = useContractorTabWorkflows(contractorId);

  if (workflows.isLoading) return <WorkflowsTabSkeleton />;
  if (workflows.items.length === 0) {
    return (
      <WorkflowsTabEmpty
        contractorId={workflows.contractorId}
        pickerOpen={workflows.pickerOpen}
        setPickerOpen={workflows.setPickerOpen}
      />
    );
  }

  return <WorkflowsTabView {...workflows} />;
}
