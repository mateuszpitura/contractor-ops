import { Text } from 'react-email';
import type { EmailBaseLabels } from './base-layout';
import { BaseLayout } from './base-layout';

interface InvoiceReceivedLabels {
  invoice?: string;
  from?: string;
  amount?: string;
}

interface InvoiceReceivedEmailProps {
  title: string;
  body: string;
  invoiceNumber?: string;
  contractorName?: string;
  amount?: string;
  ctaUrl: string;
  preferencesUrl: string;
  labels?: InvoiceReceivedLabels;
  baseLabels?: EmailBaseLabels;
}

export function InvoiceReceivedEmail({
  title,
  body,
  invoiceNumber,
  contractorName,
  amount,
  ctaUrl,
  preferencesUrl,
  labels,
  baseLabels,
}: InvoiceReceivedEmailProps) {
  const l = {
    invoice: labels?.invoice ?? 'Invoice',
    from: labels?.from ?? 'From',
    amount: labels?.amount ?? 'Amount',
  };

  return (
    <BaseLayout
      ctaUrl={ctaUrl}
      ctaLabel={baseLabels?.ctaLabel}
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
              <strong>{l.from}:</strong> {contractorName}
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

export default InvoiceReceivedEmail;
