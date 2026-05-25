import { useOnboardingSourceSelection } from './hooks/use-onboarding-source-selection.js';
import { SourceSelectionSkeleton } from './onboarding-skeletons.js';
import {
  SourceSelectionError,
  SourceSelectionHeader,
  SourceSelectionStep,
} from './source-selection-step.js';

type SourceSelectionStepContainerProps = {
  selectedSources: string[];
  onSourcesChange: (sources: string[]) => void;
};

export function SourceSelectionStepContainer(props: SourceSelectionStepContainerProps) {
  const section = useOnboardingSourceSelection(props);

  if (section.isLoading) {
    return (
      <div className="space-y-6">
        <SourceSelectionHeader />
        <SourceSelectionSkeleton />
      </div>
    );
  }

  if (section.isError) {
    return <SourceSelectionError onRefetch={section.handleRefetch} onSkip={section.handleSkip} />;
  }

  return (
    <SourceSelectionStep
      sources={section.sources}
      selectedSources={section.selectedSources}
      onToggle={section.handleToggle}
      onConnect={section.handleConnect}
      onSkip={section.handleSkip}
    />
  );
}
