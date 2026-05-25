/**
 * Web-vite port of apps/web/src/components/billing/__tests__/billing-overlay.test.tsx.
 *
 * BillingOverlay is now a pure presentational component — it receives the
 * `overlay` object (shape returned by `useBillingOverlay`) and a
 * `pastDueLabels` translation bag. Tests construct shaped `overlay`
 * literals instead of mocking tRPC + react-query.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/test/test-utils';

import { BillingOverlay } from '../billing-overlay';
import type { useBillingOverlay } from '../hooks/use-billing-overlay';

// Mock child components so assertions stay focused on overlay branching.
vi.mock('../trial-banner', () => ({
  TrialBanner: ({ trialEnd }: { trialEnd: Date }) => (
    <div data-testid="trial-banner">Trial ends {trialEnd.toISOString()}</div>
  ),
}));

vi.mock('../soft-block-modal', () => ({
  SoftBlockModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="soft-block-modal">Blocked</div> : null,
}));

type Overlay = ReturnType<typeof useBillingOverlay>;

const pastDueLabels = {
  paymentFailed: 'Payment failed.',
  paymentFailedBody: 'Update your payment method to continue using the service.',
  goToBilling: 'Go to billing',
};

function makeOverlay(override: Partial<Overlay> = {}): Overlay {
  const base = {
    subscription: { status: 'ACTIVE', trialEnd: null },
    showTrialBanner: false,
    trialEnd: null,
    isPastDue: false,
    isTrialExpired: false,
    isBlocked: false,
    handleUpgrade: vi.fn(),
    handleSelectPlan: vi.fn(),
    isSelecting: false,
    ...override,
  };
  return base as unknown as Overlay;
}

describe('BillingOverlay (web-vite)', () => {
  it('renders nothing when subscription is null', () => {
    const overlay = makeOverlay({
      subscription: null as unknown as Overlay['subscription'],
    });
    const { container } = render(
      <BillingOverlay overlay={overlay} pastDueLabels={pastDueLabels} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders trial banner when showTrialBanner and trialEnd are set', () => {
    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const overlay = makeOverlay({
      subscription: {
        status: 'TRIALING',
        trialEnd: futureDate.toISOString(),
      } as unknown as Overlay['subscription'],
      showTrialBanner: true,
      trialEnd: futureDate,
    });
    render(<BillingOverlay overlay={overlay} pastDueLabels={pastDueLabels} />);
    expect(screen.getByTestId('trial-banner')).toBeInTheDocument();
  });

  it('shows soft-block modal when trial has expired', () => {
    const overlay = makeOverlay({
      subscription: { status: 'TRIALING', trialEnd: null } as Overlay['subscription'],
      isTrialExpired: true,
    });
    render(<BillingOverlay overlay={overlay} pastDueLabels={pastDueLabels} />);
    expect(screen.getByTestId('soft-block-modal')).toBeInTheDocument();
  });

  it('shows soft-block modal when subscription is blocked (CANCELED)', () => {
    const overlay = makeOverlay({
      subscription: { status: 'CANCELED', trialEnd: null } as Overlay['subscription'],
      isBlocked: true,
    });
    render(<BillingOverlay overlay={overlay} pastDueLabels={pastDueLabels} />);
    expect(screen.getByTestId('soft-block-modal')).toBeInTheDocument();
  });

  it('shows past due banner when isPastDue is true', () => {
    const overlay = makeOverlay({
      subscription: { status: 'PAST_DUE', trialEnd: null } as Overlay['subscription'],
      isPastDue: true,
    });
    render(<BillingOverlay overlay={overlay} pastDueLabels={pastDueLabels} />);
    expect(screen.getByText('Payment failed.')).toBeInTheDocument();
  });

  it('renders no overlay elements for ACTIVE subscription', () => {
    const overlay = makeOverlay();
    render(<BillingOverlay overlay={overlay} pastDueLabels={pastDueLabels} />);
    expect(screen.queryByTestId('trial-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('soft-block-modal')).not.toBeInTheDocument();
    expect(screen.queryByText('Payment failed.')).not.toBeInTheDocument();
  });

  it('past due banner exposes alert role and Go to billing button', () => {
    const overlay = makeOverlay({
      subscription: { status: 'PAST_DUE', trialEnd: null } as Overlay['subscription'],
      isPastDue: true,
    });
    render(<BillingOverlay overlay={overlay} pastDueLabels={pastDueLabels} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    const goBtn = screen.getByText('Go to billing');
    expect(goBtn.tagName.toLowerCase()).toBe('button');
  });

  it('past due banner shows the update-payment body copy', () => {
    const overlay = makeOverlay({
      subscription: { status: 'PAST_DUE', trialEnd: null } as Overlay['subscription'],
      isPastDue: true,
    });
    render(<BillingOverlay overlay={overlay} pastDueLabels={pastDueLabels} />);
    expect(screen.getByText(/Update your payment method/)).toBeInTheDocument();
  });

  it('invokes overlay.handleUpgrade when the past-due Go to billing button is clicked', async () => {
    const handleUpgrade = vi.fn();
    const overlay = makeOverlay({
      subscription: { status: 'PAST_DUE', trialEnd: null } as Overlay['subscription'],
      isPastDue: true,
      handleUpgrade,
    });
    render(<BillingOverlay overlay={overlay} pastDueLabels={pastDueLabels} />);
    screen.getByText('Go to billing').click();
    expect(handleUpgrade).toHaveBeenCalledTimes(1);
  });

  it('renders both trial banner and past-due banner when both flags are set', () => {
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const overlay = makeOverlay({
      subscription: {
        status: 'PAST_DUE',
        trialEnd: futureDate.toISOString(),
      } as unknown as Overlay['subscription'],
      showTrialBanner: true,
      trialEnd: futureDate,
      isPastDue: true,
    });
    render(<BillingOverlay overlay={overlay} pastDueLabels={pastDueLabels} />);
    expect(screen.getByTestId('trial-banner')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
