import { useOnboardingProgress } from './hooks/use-onboarding-progress.js';
import {
  ImportProgressComplete,
  ImportProgressError,
  ImportProgressLoading,
  ImportProgressTracker,
} from './import-progress-tracker.js';

type ImportProgressTrackerContainerProps = {
  jobId: string;
};

export function ImportProgressTrackerContainer({ jobId }: ImportProgressTrackerContainerProps) {
  const section = useOnboardingProgress({ jobId });

  if (section.isError) {
    return <ImportProgressError onRefetch={section.handleRefetch} />;
  }

  if (!(section.hasData && section.progress)) {
    return <ImportProgressLoading />;
  }

  if (section.isComplete && section.progress.failedItems.length === 0) {
    return <ImportProgressComplete importedCount={section.progress.completedItems} />;
  }

  return (
    <ImportProgressTracker
      progress={section.progress}
      isFailed={section.isFailed}
      percentDone={section.percentDone}
      onRetry={section.handleRetry}
      isRetrying={section.isRetrying}
    />
  );
}
