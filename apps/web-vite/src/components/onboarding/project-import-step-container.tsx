import type { FetchProjectsOutput } from '@contractor-ops/validators';

import { useOnboardingProjects } from './hooks/use-onboarding-projects.js';
import type { ProjectSelection } from './import-wizard.js';
import { ProjectImportSkeleton } from './onboarding-skeletons.js';
import {
  ProjectImportEmpty,
  ProjectImportError,
  ProjectImportHeader,
  ProjectImportStep,
} from './project-import-step.js';

type ProjectImportStepContainerProps = {
  selectedSources: string[];
  projects: FetchProjectsOutput;
  onProjectsChange: (projects: FetchProjectsOutput) => void;
  projectSelections: Map<string, ProjectSelection>;
  onProjectSelectionsChange: (selections: Map<string, ProjectSelection>) => void;
};

export function ProjectImportStepContainer(props: ProjectImportStepContainerProps) {
  const section = useOnboardingProjects(props);

  if (section.isLoading) {
    return <ProjectImportSkeleton />;
  }

  if (section.isError) {
    return (
      <div className="space-y-6">
        <ProjectImportHeader />
        <ProjectImportError onRefetch={section.handleRefetch} />
      </div>
    );
  }

  if (section.isEmpty) {
    return (
      <div className="space-y-6">
        <ProjectImportHeader />
        <ProjectImportEmpty />
      </div>
    );
  }

  return (
    <ProjectImportStep
      projects={section.projects}
      getProjectKey={section.getProjectKey}
      getSelectionFor={section.getSelectionFor}
      onSelectionChange={section.handleSelectionChange}
    />
  );
}
