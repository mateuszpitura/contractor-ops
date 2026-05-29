import { Text } from 'react-email';
import type { EmailBaseLabels } from './base-layout';
import { BaseLayout } from './base-layout';

interface ContractExpiringLabels {
  contract?: string;
  contractor?: string;
  expires?: string;
}

interface ContractExpiringEmailProps {
  title: string;
  body: string;
  contractTitle?: string;
  contractorName?: string;
  expiryDate?: string;
  ctaUrl: string;
  preferencesUrl: string;
  labels?: ContractExpiringLabels;
  baseLabels?: EmailBaseLabels;
}

export function ContractExpiringEmail({
  title,
  body,
  contractTitle,
  contractorName,
  expiryDate,
  ctaUrl,
  preferencesUrl,
  labels,
  baseLabels,
}: ContractExpiringEmailProps) {
  const l = {
    contract: labels?.contract ?? 'Contract',
    contractor: labels?.contractor ?? 'Contractor',
    expires: labels?.expires ?? 'Expires',
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
      {!!contractTitle && (
        <Text style={{ fontSize: '14px', color: '#6b7280' }}>
          <strong>{l.contract}:</strong> {contractTitle}
          {!!contractorName && (
            <>
              <br />
              <strong>{l.contractor}:</strong> {contractorName}
            </>
          )}
          {!!expiryDate && (
            <>
              <br />
              <strong>{l.expires}:</strong> {expiryDate}
            </>
          )}
        </Text>
      )}
    </BaseLayout>
  );
}

export default ContractExpiringEmail;
