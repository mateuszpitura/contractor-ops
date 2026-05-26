import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { PlanCard } from '../plan-card';

const tier = {
  name: 'Pro',
  basePriceMinor: 9900,
  seatPriceMinor: 1500,
  creditAllowance: 1000,
  features: ['A', 'B'],
  excludedFeatures: ['X'],
  description: 'For growing teams',
};

describe('PlanCard', () => {
  it('renders tier name and CTA for choose mode', () => {
    const onSelect = vi.fn();
    render(<PlanCard tier={tier} ctaMode="choose" isRecommended={false} onSelect={onSelect} />);
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose a plan/i })).toBeInTheDocument();
  });

  it('invokes onSelect when CTA is clicked', async () => {
    const onSelect = vi.fn();
    const { user } = setup(
      <PlanCard tier={tier} ctaMode="upgrade" isRecommended onSelect={onSelect} />,
    );
    await user.click(screen.getByRole('button', { name: /upgrade plan/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
