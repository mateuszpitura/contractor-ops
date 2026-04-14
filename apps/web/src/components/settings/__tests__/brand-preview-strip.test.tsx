import { render, screen } from '@/test/test-utils';
import { BrandPreviewStrip } from '../brand-preview-strip';

describe('BrandPreviewStrip', () => {
  it('renders preview button and link text', () => {
    render(<BrandPreviewStrip color="#4f46e5" />);
    expect(screen.getByText('Sample Button')).toBeInTheDocument();
    expect(screen.getByText('Sample Link')).toBeInTheDocument();
  });

  it('accepts any hex color prop without crashing', () => {
    render(<BrandPreviewStrip color="#dc2626" />);
    expect(screen.getByText('Sample Button')).toBeInTheDocument();
  });
});
