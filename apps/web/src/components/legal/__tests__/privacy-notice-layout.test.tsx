import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { PrivacyNoticeLayout } from '../privacy-notice-layout';

vi.mock('../privacy-notice-pdf-download', () => ({
  PrivacyNoticePdfDownload: ({ jurisdiction }: { jurisdiction: string }) => (
    <button type="button" data-testid="pdf-download">
      Download {jurisdiction}
    </button>
  ),
}));

vi.mock('../privacy-notice-toc', () => ({
  PrivacyNoticeToc: () => <nav data-testid="toc">TOC</nav>,
}));

describe('PrivacyNoticeLayout', () => {
  it('renders children in main landmark', () => {
    render(
      <PrivacyNoticeLayout jurisdiction="GB">
        <p>Privacy content</p>
      </PrivacyNoticeLayout>,
    );
    expect(screen.getByText('Privacy content')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('renders skip-to-content link', () => {
    render(
      <PrivacyNoticeLayout jurisdiction="GB">
        <p>Content</p>
      </PrivacyNoticeLayout>,
    );
    expect(screen.getByText('Skip to content')).toHaveAttribute('href', '#main');
  });

  it('renders version label when provided', () => {
    render(
      <PrivacyNoticeLayout jurisdiction="EU" versionLabel="Version 2.1 — Effective 2026-01-01">
        <p>Content</p>
      </PrivacyNoticeLayout>,
    );
    expect(screen.getByText('Version 2.1 — Effective 2026-01-01')).toBeInTheDocument();
  });

  it('does not render version label when omitted', () => {
    render(
      <PrivacyNoticeLayout jurisdiction="GB">
        <p>Content</p>
      </PrivacyNoticeLayout>,
    );
    expect(screen.queryByText(/Version/)).not.toBeInTheDocument();
  });

  it('renders the PDF download component', () => {
    render(
      <PrivacyNoticeLayout jurisdiction="GB">
        <p>Content</p>
      </PrivacyNoticeLayout>,
    );
    expect(screen.getByTestId('pdf-download')).toBeInTheDocument();
  });

  it('renders the TOC component', () => {
    render(
      <PrivacyNoticeLayout jurisdiction="GB">
        <p>Content</p>
      </PrivacyNoticeLayout>,
    );
    expect(screen.getByTestId('toc')).toBeInTheDocument();
  });
});
