/**
 * Step-10 port. Renders the legal privacy-notice chrome; the PDF download +
 * TOC subcomponents reach for tRPC so we stub them to keep the test focused
 * on layout, skip-link, version label, and main landmark wiring.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../privacy-notice-pdf-download.js', () => ({
  PrivacyNoticePdfDownloadWired: ({ jurisdiction }: { jurisdiction: string }) => (
    <button type="button" data-testid="pdf-download">
      Download {jurisdiction}
    </button>
  ),
}));

vi.mock('../privacy-notice-toc.js', () => ({
  PrivacyNoticeToc: () => <nav data-testid="toc">TOC</nav>,
}));

import { render, screen } from '../../../test/test-utils.js';
import { PrivacyNoticeLayout } from '../privacy-notice-layout.js';

describe('PrivacyNoticeLayout (web-vite)', () => {
  it('renders children in main landmark', () => {
    render(
      <PrivacyNoticeLayout jurisdiction="GB">
        <p>Privacy content</p>
      </PrivacyNoticeLayout>,
    );
    expect(screen.getByText('Privacy content')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('renders the skip-to-content link pointing at #main', () => {
    render(
      <PrivacyNoticeLayout jurisdiction="GB">
        <p>Content</p>
      </PrivacyNoticeLayout>,
    );
    expect(screen.getByText('Skip to content')).toHaveAttribute('href', '#main');
  });

  it('renders the version label when provided', () => {
    render(
      <PrivacyNoticeLayout jurisdiction="EU" versionLabel="Version 2.1 — Effective 2026-01-01">
        <p>Content</p>
      </PrivacyNoticeLayout>,
    );
    expect(screen.getByText('Version 2.1 — Effective 2026-01-01')).toBeInTheDocument();
  });

  it('omits the version label when not provided', () => {
    render(
      <PrivacyNoticeLayout jurisdiction="GB">
        <p>Content</p>
      </PrivacyNoticeLayout>,
    );
    expect(screen.queryByText(/Version/)).not.toBeInTheDocument();
  });

  it('renders the PDF download container with the given jurisdiction', () => {
    render(
      <PrivacyNoticeLayout jurisdiction="GB">
        <p>Content</p>
      </PrivacyNoticeLayout>,
    );
    expect(screen.getByTestId('pdf-download')).toHaveTextContent('Download GB');
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
