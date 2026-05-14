import { render, screen } from '@/test/test-utils';
import { CreditCard } from '../credit-progress-bar';

function noop() {
  /* no-op */
}

describe('CreditCard', () => {
  it('renders used count and subtitle when credits are available', () => {
    render(<CreditCard used={30} total={100} isLowCredits={false} onBuyMore={noop} />);
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('30 used / 100 total')).toBeInTheDocument();
  });

  it('renders exhausted text when all credits are used', () => {
    render(<CreditCard used={100} total={100} isLowCredits={true} onBuyMore={noop} />);
    expect(
      screen.getByText('No credits remaining -- purchase more to continue OCR processing'),
    ).toBeInTheDocument();
  });

  it('renders exhausted text when used exceeds total', () => {
    render(<CreditCard used={120} total={100} isLowCredits={true} onBuyMore={noop} />);
    expect(
      screen.getByText('No credits remaining -- purchase more to continue OCR processing'),
    ).toBeInTheDocument();
  });

  it('handles zero total gracefully', () => {
    render(<CreditCard used={0} total={0} isLowCredits={false} onBuyMore={noop} />);
    expect(screen.getByText('0 used / 0 total')).toBeInTheDocument();
  });

  it('renders a progressbar element', () => {
    render(<CreditCard used={10} total={100} isLowCredits={false} onBuyMore={noop} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows buy more button when credits are low', () => {
    render(<CreditCard used={90} total={100} isLowCredits={true} onBuyMore={noop} />);
    expect(screen.getByText('Buy more')).toBeInTheDocument();
  });

  it('hides buy more button when credits are sufficient', () => {
    render(<CreditCard used={10} total={100} isLowCredits={false} onBuyMore={noop} />);
    expect(screen.queryByText('Buy more')).not.toBeInTheDocument();
  });
});
