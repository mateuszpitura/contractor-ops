import type { FetchProjectsOutput } from '@contractor-ops/validators';

import { useOnboardingProjects } from './hooks/use-onboarding-projects.js';
import type { ProjectSelection } from './import-wizard.js';
import { ProjectImportStep } from './project-import-step.js';

type ProjectImportStepContainerProps = {
  selectedSources: string[];
  projects: FetchProjectsOutput;
  onProjectsChange: (projects: FetchProjectsOutput) => void;
  projectSelections: Map<string, ProjectSelection>;
  onProjectSelectionsChange: (selections: Map<string, ProjectSelection>) => void;
};

export function ProjectImportStepContainer(props: ProjectImportStepContainerProps) {
  const section = useOnboardingProjects(props);

  return (
    <ProjectImportStep
      isLoading={section.isLoading}
      isError={section.isError}
      isEmpty={section.isEmpty}
      onRefetch={section.handleRefetch}
      projects={section.projects}
      getProjectKey={section.getProjectKey}
      getSelectionFor={section.getSelectionFor}
      onSelectionChange={section.handleSelectionChange}
    />
  );
}
