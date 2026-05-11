import { Text } from 'react-email';
import { BaseLayout } from './base-layout';

interface ApprovalDecisionLabels {
  decision?: string;
  by?: string;
  comment?: string;
}

interface ApprovalDecisionEmailProps {
  title: string;
  body: string;
  decision?: string;
  approverName?: string;
  comment?: string;
  ctaUrl: string;
  preferencesUrl: string;
  labels?: ApprovalDecisionLabels;
}

export function ApprovalDecisionEmail({
  title,
  body,
  decision,
  approverName,
  comment,
  ctaUrl,
  preferencesUrl,
  labels,
}: ApprovalDecisionEmailProps) {
  const l = {
    decision: labels?.decision ?? 'Decision',
    by: labels?.by ?? 'By',
    comment: labels?.comment ?? 'Comment',
  };

  return (
    <BaseLayout ctaUrl={ctaUrl} preferencesUrl={preferencesUrl}>
      <Text style={{ fontSize: '20px', fontWeight: '600', color: '#1a1a1a' }}>{title}</Text>
      <Text style={{ fontSize: '14px', color: '#4a4a4a', lineHeight: '24px' }}>{body}</Text>
      {!!decision && (
        <Text style={{ fontSize: '14px', color: '#6b7280' }}>
          <strong>{l.decision}:</strong> {decision}
          {!!approverName && (
            <>
              <br />
              <strong>{l.by}:</strong> {approverName}
            </>
          )}
          {!!comment && (
            <>
              <br />
              <strong>{l.comment}:</strong> {comment}
            </>
          )}
        </Text>
      )}
    </BaseLayout>
  );
}

export default ApprovalDecisionEmail;
