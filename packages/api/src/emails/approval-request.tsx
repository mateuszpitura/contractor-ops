import { Text } from 'react-email';
import type { EmailBaseLabels } from './base-layout';
import { BaseLayout } from './base-layout';

interface ApprovalRequestLabels {
  invoice?: string;
  contractor?: string;
  amount?: string;
  ctaButton?: string;
}

interface ApprovalRequestEmailProps {
  title: string;
  body: string;
  invoiceNumber?: string;
  contractorName?: string;
  amount?: string;
  ctaUrl: string;
  preferencesUrl: string;
  labels?: ApprovalRequestLabels;
  baseLabels?: EmailBaseLabels;
}

export function ApprovalRequestEmail({
  title,
  body,
  invoiceNumber,
  contractorName,
  amount,
  ctaUrl,
  preferencesUrl,
  labels,
  baseLabels,
}: ApprovalRequestEmailProps) {
  const l = {
    invoice: labels?.invoice ?? 'Invoice',
    contractor: labels?.contractor ?? 'Contractor',
    amount: labels?.amount ?? 'Amount',
    ctaButton: labels?.ctaButton ?? 'Review & Approve',
  };

  return (
    <BaseLayout
      ctaUrl={ctaUrl}
      ctaLabel={baseLabels?.ctaLabel ?? l.ctaButton}
      managePrefsLabel={baseLabels?.managePrefsLabel}
      unsubscribeLabel={baseLabels?.unsubscribeLabel}
      footerText={baseLabels?.footerText}
      preferencesUrl={preferencesUrl}>
      <Text style={{ fontSize: '20px', fontWeight: '600', color: '#1a1a1a' }}>{title}</Text>
      <Text style={{ fontSize: '14px', color: '#4a4a4a', lineHeight: '24px' }}>{body}</Text>
      {!!invoiceNumber && (
        <Text style={{ fontSize: '14px', color: '#6b7280' }}>
          <strong>{l.invoice}:</strong> {invoiceNumber}
          {!!contractorName && (
            <>
              <br />
              <strong>{l.contractor}:</strong> {contractorName}
            </>
          )}
          {!!amount && (
            <>
              <br />
              <strong>{l.amount}:</strong> {amount}
            </>
          )}
        </Text>
      )}
    </BaseLayout>
  );
}

export default ApprovalRequestEmail;
