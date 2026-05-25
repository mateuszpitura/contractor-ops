import { AuditTimeline, AuditTimelineSkeleton } from './audit-timeline.js';
import { useApprovalAuditTrail } from './hooks/use-approval-audit-trail.js';

interface AuditTimelineContainerProps {
  invoiceId: string;
}

export function AuditTimelineContainer({ invoiceId }: AuditTimelineContainerProps) {
  const audit = useApprovalAuditTrail(invoiceId);

  if (audit.isLoading) return <AuditTimelineSkeleton />;

  return (
    <AuditTimeline
      events={(audit.events as unknown as Parameters<typeof AuditTimeline>[0]['events']) ?? []}
    />
  );
}
