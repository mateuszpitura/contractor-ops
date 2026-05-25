import { render, screen } from '@/test/test-utils';

import { ReverseChargeBanner } from '../reverse-charge-banner';

describe('ReverseChargeBanner', () => {
  it('renders banner title', () => {
    render(<ReverseChargeBanner onRemove={vi.fn()} />);
    expect(screen.getByText('Reverse charge applied')).toBeInTheDocument();
  });

  it('renders cross-border description text', () => {
    render(<ReverseChargeBanner onRemove={vi.fn()} />);
    expect(screen.getByText(/Cross-border B2B transaction/)).toBeInTheDocument();
  });

  it('renders Override dropdown trigger', () => {
    render(<ReverseChargeBanner onRemove={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Override/ })).toBeInTheDocument();
  });
});
