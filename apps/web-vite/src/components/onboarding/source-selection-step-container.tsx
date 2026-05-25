import { useOnboardingSourceSelection } from './hooks/use-onboarding-source-selection.js';
import { SourceSelectionStep } from './source-selection-step.js';

type SourceSelectionStepContainerProps = {
  selectedSources: string[];
  onSourcesChange: (sources: string[]) => void;
};

export function SourceSelectionStepContainer(props: SourceSelectionStepContainerProps) {
  const section = useOnboardingSourceSelection(props);

  return (
    <SourceSelectionStep
      isLoading={section.isLoading}
      isError={section.isError}
      sources={section.sources}
      selectedSources={section.selectedSources}
      onToggle={section.handleToggle}
      onConnect={section.handleConnect}
      onRefetch={section.handleRefetch}
      onSkip={section.handleSkip}
    />
  );
}
