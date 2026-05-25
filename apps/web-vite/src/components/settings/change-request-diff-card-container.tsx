// Decision: card widget mounted by parent change-request inbox (out of settings scope). Container
// scopes the approve/reject mutation hooks per request id.
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
