import { Text } from 'react-email';
import type { EmailBaseLabels } from './base-layout';
import { BaseLayout } from './base-layout';

interface GenericNotificationEmailProps {
  title: string;
  body: string;
  ctaUrl?: string;
  preferencesUrl?: string;
  baseLabels?: EmailBaseLabels;
}

export function GenericNotificationEmail({
  title,
  body,
  ctaUrl,
  preferencesUrl,
  baseLabels,
}: GenericNotificationEmailProps) {
  return (
    <BaseLayout
      ctaUrl={ctaUrl}
      ctaLabel={baseLabels?.ctaLabel}
      managePrefsLabel={baseLabels?.managePrefsLabel}
      unsubscribeLabel={baseLabels?.unsubscribeLabel}
      footerText={baseLabels?.footerText}
      preferencesUrl={preferencesUrl}>
      <Text style={{ fontSize: '20px', fontWeight: '600', color: '#1a1a1a' }}>{title}</Text>
      <Text
        style={{ fontSize: '14px', color: '#4a4a4a', lineHeight: '24px', whiteSpace: 'pre-wrap' }}>
        {body}
      </Text>
    </BaseLayout>
  );
}

export default GenericNotificationEmail;
