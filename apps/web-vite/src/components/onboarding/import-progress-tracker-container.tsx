import { useOnboardingProgress } from './hooks/use-onboarding-progress.js';
import { ImportProgressTracker } from './import-progress-tracker.js';

type ImportProgressTrackerContainerProps = {
  jobId: string;
};

export function ImportProgressTrackerContainer({ jobId }: ImportProgressTrackerContainerProps) {
  const section = useOnboardingProgress({ jobId });

  return (
    <ImportProgressTracker
      isError={section.isError}
      hasData={section.hasData}
      progress={section.progress}
      isComplete={section.isComplete}
      isFailed={section.isFailed}
      isRunning={section.isRunning}
      percentDone={section.percentDone}
      onRefetch={section.handleRefetch}
      onRetry={section.handleRetry}
      isRetrying={section.isRetrying}
    />
  );
}
