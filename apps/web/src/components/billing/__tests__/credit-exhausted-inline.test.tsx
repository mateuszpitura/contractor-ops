import { screen, setup } from '@/test/test-utils';
import { CreditExhaustedInline } from '../credit-exhausted-inline';

describe('CreditExhaustedInline', () => {
  it('renders the alert with exhaustion message', () => {
    setup(<CreditExhaustedInline onUpgrade={vi.fn()} onBuyCredits={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('OCR credits exhausted')).toBeInTheDocument();
    expect(screen.getByText(/You have used all OCR credits this month/)).toBeInTheDocument();
  });

  it('calls onUpgrade when Upgrade plan button is clicked', async () => {
    const onUpgrade = vi.fn();
    const { user } = setup(<CreditExhaustedInline onUpgrade={onUpgrade} onBuyCredits={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /upgrade plan/i }));
    expect(onUpgrade).toHaveBeenCalledOnce();
  });

  it('calls onBuyCredits when Buy credits button is clicked', async () => {
    const onBuyCredits = vi.fn();
    const { user } = setup(
      <CreditExhaustedInline onUpgrade={vi.fn()} onBuyCredits={onBuyCredits} />,
    );
    await user.click(screen.getByRole('button', { name: /buy credits/i }));
    expect(onBuyCredits).toHaveBeenCalledOnce();
  });
});
