import { render, screen } from '@/test/test-utils';
import { LabelDisplay } from '../shipment-label-view';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt as string} />
  ),
}));

describe('LabelDisplay', () => {
  it('returns null when no label is provided', () => {
    const { container } = render(<LabelDisplay />);
    expect(container.firstChild).toBeNull();
  });

  it('renders an image when label format is IMAGE', () => {
    render(<LabelDisplay label={{ url: 'https://example.com/label.png', format: 'IMAGE' }} />);
    expect(screen.getByAltText('Shipping label')).toBeInTheDocument();
  });

  it('renders a PDF object when label format is PDF', () => {
    const { container } = render(
      <LabelDisplay label={{ url: 'https://example.com/label.pdf', format: 'PDF' }} />,
    );
    const obj = container.querySelector('object');
    expect(obj).toHaveAttribute('data', 'https://example.com/label.pdf');
    expect(obj).toHaveAttribute('type', 'application/pdf');
  });

  it('renders PDF fallback download link', () => {
    render(<LabelDisplay label={{ url: 'https://example.com/label.pdf', format: 'PDF' }} />);
    expect(screen.getByText('Download label (PDF)')).toBeInTheDocument();
  });

  it('renders tracking number when provided', () => {
    render(
      <LabelDisplay
        label={{ url: 'https://example.com/label.png', format: 'IMAGE' }}
        trackingNumber="TRK12345"
      />,
    );
    expect(screen.getByText(/Tracking: TRK12345/)).toBeInTheDocument();
  });

  it('renders drop-off location when paczkomatName is provided', () => {
    render(
      <LabelDisplay
        label={{ url: 'https://example.com/label.png', format: 'IMAGE' }}
        paczkomatName="WAW-01A"
      />,
    );
    expect(screen.getByText(/Drop-off: WAW-01A/)).toBeInTheDocument();
  });

  it('renders download link', () => {
    render(<LabelDisplay label={{ url: 'https://example.com/label.png', format: 'IMAGE' }} />);
    const downloadLink = screen.getByText('Download');
    expect(downloadLink).toHaveAttribute('href', 'https://example.com/label.png');
    expect(downloadLink).toHaveAttribute('download', '');
  });

  it('renders print button', () => {
    render(<LabelDisplay label={{ url: 'https://example.com/label.png', format: 'IMAGE' }} />);
    expect(screen.getByText('Print')).toBeInTheDocument();
  });
});
