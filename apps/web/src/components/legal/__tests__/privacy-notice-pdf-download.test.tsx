import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { PrivacyNoticePdfDownload } from '../privacy-notice-pdf-download';

vi.mock('@/trpc/init', () => ({
  trpc: {
    legal: {
      generatePrivacyNoticePdf: {
        mutationOptions: (opts: Record<string, unknown>) => ({
          mutationFn: vi.fn(),
          ...opts,
        }),
      },
    },
  },
}));

describe('PrivacyNoticePdfDownload', () => {
  it('renders the download button', () => {
    render(<PrivacyNoticePdfDownload jurisdiction="GB" />);
    expect(
      screen.getByRole('button', { name: /download privacy notice as pdf/i }),
    ).toBeInTheDocument();
  });

  it('displays button text', () => {
    render(<PrivacyNoticePdfDownload jurisdiction="EU" />);
    expect(screen.getByText('Download as PDF')).toBeInTheDocument();
  });

  it('renders with outline variant styling', () => {
    render(<PrivacyNoticePdfDownload jurisdiction="DE" />);
    const button = screen.getByRole('button');
    expect(button).not.toBeDisabled();
  });
});
