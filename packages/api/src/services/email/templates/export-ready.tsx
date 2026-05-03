/**
 * "Your export is ready" transactional email (P2-F · F-SCALE-01).
 *
 * Sent by the QStash export consumer once an `Export` row transitions to
 * `READY`. The email links to a download route that signs a fresh R2 URL
 * on click — the link itself does not embed the presigned URL so it
 * remains valid for the entire `maxAgeDays` retention window without
 * leaking a signed URL into long-lived inboxes.
 */

import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

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

const heading = {
  color: '#0f172a',
  fontSize: '20px',
  fontWeight: '600' as const,
  lineHeight: '28px',
  margin: '0 0 12px',
};

const paragraph = {
  color: '#334155',
  fontSize: '15px',
  lineHeight: '22px',
  margin: '0 0 16px',
};

const meta = {
  color: '#64748b',
  fontSize: '13px',
  lineHeight: '18px',
  margin: '0 0 4px',
};

const ctaButton = {
  backgroundColor: '#4f46e5',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600' as const,
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 28px',
};

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  padding: '0 48px',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '24px 0',
};

export interface ExportReadyEmailProps {
  /** Display name of the export type, e.g. "Spend by contractor". */
  exportDisplayName: string;
  /** Filename the user will see in the download dialog. */
  fileName: string;
  /** Absolute URL to the in-app download route — signed lazily on click. */
  downloadUrl: string;
  /** ISO timestamp when the R2 object will be deleted. */
  expiresAtIso: string;
  /** Number of rows in the export, when known (CSV exports). */
  rowCount?: number | null;
  /** Footer brand label. */
  footerText?: string;
}

/**
 * Branded React Email template for the "your export is ready" notification.
 * Pure JSX — `@react-email/render` converts to HTML/plain-text on send.
 */
export function ExportReadyEmail({
  exportDisplayName,
  fileName,
  downloadUrl,
  expiresAtIso,
  rowCount,
  footerText = 'Contractor Ops · Contractor operations platform',
}: ExportReadyEmailProps) {
  const expiresOn = new Date(expiresAtIso).toUTCString();
  const previewText = `${exportDisplayName} is ready to download (${fileName})`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={logo}>Contractor Ops</Text>
          <Section style={content}>
            <Text style={heading}>Your export is ready</Text>
            <Text style={paragraph}>
              We've finished preparing your <strong>{exportDisplayName}</strong> export. Click below
              to download.
            </Text>

            <Section style={{ textAlign: 'center', margin: '24px 0' }}>
              <Button style={ctaButton} href={downloadUrl}>
                Download {fileName}
              </Button>
            </Section>

            <Text style={meta}>File: {fileName}</Text>
            {rowCount != null && <Text style={meta}>Rows: {rowCount.toLocaleString('en-US')}</Text>}
            <Text style={meta}>Available until: {expiresOn}</Text>
            <Text style={meta}>
              This download link is valid until the file is purged. After that you'll need to
              re-request the export.
            </Text>
          </Section>
          <Hr style={hr} />
          <Section style={{ padding: '0 48px' }}>
            <Text style={footer}>
              You're receiving this email because someone in your workspace requested an export. If
              that wasn't you, contact your workspace admin.
            </Text>
            <Text style={footer}>{footerText}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default ExportReadyEmail;
