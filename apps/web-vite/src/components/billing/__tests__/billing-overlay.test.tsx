/**
 * BillingOverlayContainer is decisive: it branches on overlay flags and
 * renders TrialBanner / BillingPastDueBanner / SoftBlockModal siblings.
 * Tests stub `useBillingOverlay` + `useTranslations` so assertions stay
 * focused on container branching without touching tRPC.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/test/test-utils';

import type { useBillingOverlay } from '../hooks/use-billing-overlay';

const overlayMock = vi.fn();

vi.mock('../hooks/use-billing-overlay', () => ({
  useBillingOverlay: () => overlayMock(),
}));

vi.mock('../../../i18n/useTranslations.js', () => ({
  useTranslations: () => (key: string) => {
    const labels: Record<string, string> = {
      paymentFailed: 'Payment failed.',
      paymentFailedBody: 'Update your payment method to continue using the service.',
      goToBilling: 'Go to billing',
    };
    return labels[key] ?? key;
  },
}));

vi.mock('../trial-banner', () => ({
  TrialBanner: ({ trialEnd }: { trialEnd: Date }) => (
    <div data-testid="trial-banner">Trial ends {trialEnd.toISOString()}</div>
  ),
}));

vi.mock('../soft-block-modal', () => ({
  SoftBlockModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="soft-block-modal">Blocked</div> : null,
}));

import { BillingPastDueBanner } from '../billing-overlay';
import { BillingOverlayContainer } from '../billing-overlay-container';

type Overlay = ReturnType<typeof useBillingOverlay>;

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

describe('BillingOverlayContainer (web-vite)', () => {
  it('renders nothing when subscription is null', () => {
    overlayMock.mockReturnValue(
      makeOverlay({ subscription: null as unknown as Overlay['subscription'] }),
    );
    const { container } = render(<BillingOverlayContainer />);
    expect(container.innerHTML).toBe('');
  });

  it('renders trial banner when showTrialBanner and trialEnd are set', () => {
    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    overlayMock.mockReturnValue(
      makeOverlay({
        subscription: {
          status: 'TRIALING',
          trialEnd: futureDate.toISOString(),
        } as unknown as Overlay['subscription'],
        showTrialBanner: true,
        trialEnd: futureDate,
      }),
    );
    render(<BillingOverlayContainer />);
    expect(screen.getByTestId('trial-banner')).toBeInTheDocument();
  });

  it('shows soft-block modal when trial has expired', () => {
    overlayMock.mockReturnValue(
      makeOverlay({
        subscription: { status: 'TRIALING', trialEnd: null } as Overlay['subscription'],
        isTrialExpired: true,
      }),
    );
    render(<BillingOverlayContainer />);
    expect(screen.getByTestId('soft-block-modal')).toBeInTheDocument();
  });

  it('shows soft-block modal when subscription is blocked (CANCELED)', () => {
    overlayMock.mockReturnValue(
      makeOverlay({
        subscription: { status: 'CANCELED', trialEnd: null } as Overlay['subscription'],
        isBlocked: true,
      }),
    );
    render(<BillingOverlayContainer />);
    expect(screen.getByTestId('soft-block-modal')).toBeInTheDocument();
  });

  it('shows past due banner when isPastDue is true', () => {
    overlayMock.mockReturnValue(
      makeOverlay({
        subscription: { status: 'PAST_DUE', trialEnd: null } as Overlay['subscription'],
        isPastDue: true,
      }),
    );
    render(<BillingOverlayContainer />);
    expect(screen.getByText('Payment failed.')).toBeInTheDocument();
  });

  it('renders no overlay elements for ACTIVE subscription', () => {
    overlayMock.mockReturnValue(makeOverlay());
    render(<BillingOverlayContainer />);
    expect(screen.queryByTestId('trial-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('soft-block-modal')).not.toBeInTheDocument();
    expect(screen.queryByText('Payment failed.')).not.toBeInTheDocument();
  });

  it('renders both trial banner and past-due banner when both flags are set', () => {
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    overlayMock.mockReturnValue(
      makeOverlay({
        subscription: {
          status: 'PAST_DUE',
          trialEnd: futureDate.toISOString(),
        } as unknown as Overlay['subscription'],
        showTrialBanner: true,
        trialEnd: futureDate,
        isPastDue: true,
      }),
    );
    render(<BillingOverlayContainer />);
    expect(screen.getByTestId('trial-banner')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

describe('BillingPastDueBanner (web-vite)', () => {
  const labels = {
    paymentFailed: 'Payment failed.',
    paymentFailedBody: 'Update your payment method to continue using the service.',
    goToBilling: 'Go to billing',
  };

  it('exposes alert role and Go to billing button', () => {
    render(<BillingPastDueBanner onResolve={vi.fn()} labels={labels} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    const goBtn = screen.getByText('Go to billing');
    expect(goBtn.tagName.toLowerCase()).toBe('button');
  });

  it('shows the update-payment body copy', () => {
    render(<BillingPastDueBanner onResolve={vi.fn()} labels={labels} />);
    expect(screen.getByText(/Update your payment method/)).toBeInTheDocument();
  });

  it('invokes onResolve when the Go to billing button is clicked', () => {
    const onResolve = vi.fn();
    render(<BillingPastDueBanner onResolve={onResolve} labels={labels} />);
    screen.getByText('Go to billing').click();
    expect(onResolve).toHaveBeenCalledTimes(1);
  });
});
