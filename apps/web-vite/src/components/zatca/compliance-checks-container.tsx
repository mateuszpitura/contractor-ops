import type { ComplianceChecksViewProps } from './compliance-checks.js';
import { ComplianceChecksIdle, ComplianceChecksResults } from './compliance-checks.js';
import { useComplianceChecks } from './hooks/use-compliance-checks.js';

export function ComplianceChecks(props: Pick<ComplianceChecksViewProps, 'onSuccess' | 'onBack'>) {
  const hook = useComplianceChecks();
  const hasActivity = hook.results.length > 0 || hook.isPending;

  if (!hasActivity) {
    return (
      <ComplianceChecksIdle
        onSuccess={props.onSuccess}
        onBack={props.onBack}
        runChecks={hook.runChecks}
        isPending={hook.isPending}
        t={hook.t}
      />
    );
  }

  return (
    <ComplianceChecksResults
      onSuccess={props.onSuccess}
      onBack={props.onBack}
      results={hook.results}
      isPending={hook.isPending}
      allPassed={hook.allPassed}
      completedCount={hook.completedCount}
      progressValue={hook.progressValue}
      testLabels={hook.testLabels}
      t={hook.t}
    />
  );
}
