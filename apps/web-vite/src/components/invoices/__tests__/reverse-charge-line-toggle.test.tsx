import { render, screen, setup } from '@/test/test-utils';
import { ReverseChargeLineToggle } from '../reverse-charge-line-toggle';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

describe('ReverseChargeLineToggle', () => {
  const defaultProps = {
    isReverseCharge: true,
    onDisable: vi.fn(),
  };

  it('renders the toggle switch', () => {
    render(<ReverseChargeLineToggle {...defaultProps} />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('renders "Reverse charge" label', () => {
    render(<ReverseChargeLineToggle {...defaultProps} />);
    expect(screen.getByText('Reverse charge')).toBeInTheDocument();
  });

  it('renders RC auto-detected badge when isReverseCharge is true', () => {
    render(<ReverseChargeLineToggle {...defaultProps} />);
    expect(screen.getByTestId('reverse-charge-chip')).toBeInTheDocument();
    expect(screen.getByText('RC auto-detected')).toBeInTheDocument();
  });

  it('renders custom ruleLabel in badge', () => {
    render(<ReverseChargeLineToggle {...defaultProps} ruleLabel="EU B2B Art. 44" />);
    expect(screen.getByText('EU B2B Art. 44')).toBeInTheDocument();
  });

  it('does not render badge when isReverseCharge is false', () => {
    render(<ReverseChargeLineToggle isReverseCharge={false} onDisable={vi.fn()} />);
    expect(screen.queryByTestId('reverse-charge-chip')).not.toBeInTheDocument();
  });

  it('switch is checked when isReverseCharge is true', () => {
    render(<ReverseChargeLineToggle {...defaultProps} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('disables the switch when disabled prop is true', () => {
    render(<ReverseChargeLineToggle {...defaultProps} disabled />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-disabled', 'true');
  });

  it('opens confirmation dialog when toggling off', async () => {
    const { user } = setup(<ReverseChargeLineToggle {...defaultProps} />);
    await user.click(screen.getByRole('switch'));
    expect(screen.getByText('Override auto-detected reverse charge?')).toBeInTheDocument();
  });

  it('has correct aria-label on the switch', () => {
    render(<ReverseChargeLineToggle {...defaultProps} />);
    expect(screen.getByLabelText('Apply reverse charge to this line')).toBeInTheDocument();
  });
});
