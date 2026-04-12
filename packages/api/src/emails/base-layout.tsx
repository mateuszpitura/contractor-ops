import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Section,
  Text,
} from '@react-email/components';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '580px',
};

const logo = {
  fontSize: '24px',
  fontWeight: '700' as const,
  color: '#4f46e5',
  padding: '20px 48px',
};

const content = {
  padding: '0 48px',
};

const ctaButton = {
  backgroundColor: '#4f46e5',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600' as const,
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '16px 24px',
};

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  padding: '0 48px',
};

const footerLink = {
  color: '#8898aa',
  textDecoration: 'underline',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 0',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface BaseLayoutProps {
  children: ReactNode;
  ctaUrl?: string;
  ctaText?: string;
  preferencesUrl?: string;
  /** Label for the CTA button. Accepts translated text. */
  ctaLabel?: string;
  /** Label for the "Manage notification preferences" link. */
  managePrefsLabel?: string;
  /** Label for the "Unsubscribe" link. */
  unsubscribeLabel?: string;
  /** Footer brand text. */
  footerText?: string;
}

export function BaseLayout({
  children,
  ctaUrl,
  ctaText,
  ctaLabel,
  preferencesUrl,
  managePrefsLabel = 'Manage notification preferences',
  unsubscribeLabel = 'Unsubscribe',
  footerText = 'Contractor Ops - Contractor operations platform',
}: BaseLayoutProps) {
  const resolvedCtaLabel = ctaLabel ?? ctaText ?? 'View in Contractor Ops';

  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Text style={logo}>Contractor Ops</Text>
          <Section style={content}>
            {children}
            {ctaUrl && (
              <Section style={{ textAlign: 'center', margin: '32px 0' }}>
                <Button style={ctaButton} href={ctaUrl}>
                  {resolvedCtaLabel}
                </Button>
              </Section>
            )}
          </Section>
          <Hr style={hr} />
          <Section style={{ padding: '0 48px' }}>
            <Text style={footer}>
              {preferencesUrl && (
                <>
                  <Link style={footerLink} href={preferencesUrl}>
                    {managePrefsLabel}
                  </Link>
                  {' | '}
                </>
              )}
              <Link style={footerLink} href={preferencesUrl ?? '#'}>
                {unsubscribeLabel}
              </Link>
            </Text>
            <Text style={footer}>{footerText}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default BaseLayout;
