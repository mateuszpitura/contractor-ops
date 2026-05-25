import { ChainTracker, ChainTrackerSkeleton } from './chain-tracker.js';
import { useApprovalAuditTrail } from './hooks/use-approval-audit-trail.js';

interface ChainTrackerContainerProps {
  invoiceId: string;
}

type ChainTrackerFlow = {
  steps?: Parameters<typeof ChainTracker>[0]['steps'];
  chainName?: string;
};

export function ChainTrackerContainer({ invoiceId }: ChainTrackerContainerProps) {
  const audit = useApprovalAuditTrail(invoiceId);

  if (audit.isLoading) return <ChainTrackerSkeleton />;

  const flow = audit.flow as ChainTrackerFlow | undefined;
  const steps = flow?.steps;
  if (!steps || steps.length === 0) return null;

  return <ChainTracker steps={steps} chainName={flow?.chainName} />;
}
