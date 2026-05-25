import type { FetchProjectsOutput, MergedPerson } from '@contractor-ops/validators';
import { ConfirmImportStep } from './confirm-import-step.js';
import { useOnboardingConfirm } from './hooks/use-onboarding-confirm.js';
import type { PersonSelection, ProjectSelection } from './import-wizard.js';

type ConfirmImportStepContainerProps = {
  mergedPeople: MergedPerson[];
  personSelections: Map<string, PersonSelection>;
  projects: FetchProjectsOutput;
  projectSelections: Map<string, ProjectSelection>;
  jobId: string | null;
  onJobIdChange: (jobId: string) => void;
};

export function ConfirmImportStepContainer(props: ConfirmImportStepContainerProps) {
  const section = useOnboardingConfirm({
    mergedPeople: props.mergedPeople,
    personSelections: props.personSelections,
    projects: props.projects,
    projectSelections: props.projectSelections,
    onJobIdChange: props.onJobIdChange,
  });

  return (
    <ConfirmImportStep
      jobId={props.jobId}
      peopleToImportCount={section.peopleToImport.length}
      projectsToImportCount={section.projectsToImport.length}
      totalSteps={section.totalSteps}
      roleBreakdown={section.roleBreakdown}
      isStarting={section.isStarting}
      canStart={section.canStart}
      onStartImport={section.handleStartImport}
    />
  );
}
