import type { ComplianceCsidViewProps } from './compliance-csid.js';
import { ComplianceCsidIdle, ComplianceCsidProgress } from './compliance-csid.js';
import { useComplianceCsid } from './hooks/use-compliance-csid.js';

export function ComplianceCsid(props: Pick<ComplianceCsidViewProps, 'onSuccess' | 'onBack'>) {
  const { phase, requestComplianceCsid, isPending, csidReceived, certStored, t } =
    useComplianceCsid();

  if (phase === 'idle') {
    return (
      <ComplianceCsidIdle
        onSuccess={props.onSuccess}
        onBack={props.onBack}
        requestComplianceCsid={requestComplianceCsid}
        isPending={isPending}
        t={t}
      />
    );
  }

  return (
    <ComplianceCsidProgress
      onSuccess={props.onSuccess}
      onBack={props.onBack}
      csidReceived={csidReceived}
      certStored={certStored}
      t={t}
    />
  );
}
