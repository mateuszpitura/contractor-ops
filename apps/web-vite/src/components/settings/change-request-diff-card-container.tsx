import { ChangeRequestDiffCard } from './change-request-diff-card.js';
import { useChangeRequestDiffCard } from './hooks/use-change-request-diff-card.js';

interface ChangeRequestDiffCardContainerProps {
  request: {
    id: string;
    contractorName: string;
    contractorEmail: string;
    requestedChanges: Record<string, unknown>;
    previousValues: Record<string, unknown>;
    createdAt: Date | string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
  };
  onApproved?: () => void;
  onRejected?: () => void;
}

// Decision: mutation host — card mounted by the change-request inbox per request id;
// hook exposes approve/reject handlers + isPending consumed inline by the card view.
export function ChangeRequestDiffCardContainer({
  request,
  onApproved,
  onRejected,
}: ChangeRequestDiffCardContainerProps) {
  const card = useChangeRequestDiffCard({
    requestId: request.id,
    onApproved,
    onRejected,
  });
  return <ChangeRequestDiffCard request={request} {...card} />;
}
