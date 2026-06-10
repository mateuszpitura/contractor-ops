import { render, screen, setup } from '@/test/test-utils';

import { DownloadZugferdPdfButtonView } from '../download-zugferd-pdf-button';

describe('DownloadZugferdPdfButton', () => {
  it('renders the download CTA when idle', () => {
    render(<DownloadZugferdPdfButtonView onDownload={vi.fn()} isPending={false} />);
    expect(screen.getByTestId('download-zugferd-pdf-button')).toBeInTheDocument();
    // Idle copy
    expect(screen.getByText(/Download ZUGFeRD/i)).toBeInTheDocument();
  });

  it('shows the generating-label and disables the button while pending', () => {
    render(<DownloadZugferdPdfButtonView onDownload={vi.fn()} isPending />);
    const btn = screen.getByTestId('download-zugferd-pdf-button');
    expect(btn).toBeDisabled();
    expect(screen.getByText(/Generating/i)).toBeInTheDocument();
  });

  it('invokes onDownload when clicked', async () => {
    const onDownload = vi.fn();
    const { user } = setup(
      <DownloadZugferdPdfButtonView onDownload={onDownload} isPending={false} />,
    );
    await user.click(screen.getByTestId('download-zugferd-pdf-button'));
    expect(onDownload).toHaveBeenCalledTimes(1);
  });
});
