/**
 * Web-vite port of apps/web/src/components/billing/__tests__/billing-tab.test.tsx.
 *
 * BillingTabContainer is now decisive: it owns selectedPriceId state,
 * the useBillingTab hook, and composes UsageDashboardContainer +
 * ProrationPreviewContainer + Manage-billing button directly (the old
 * BillingTab view file is gone). Tests stub the domain hook and child
 * containers so assertions stay focused on container branching.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';
import type { useBillingTab } from '../hooks/use-billing';

interface Mutation {
  isPending: boolean;
  mutate: (...args: unknown[]) => unknown;
}

function makeMutation(overrides: Partial<Mutation> = {}): Mutation {
  return { isPending: false, mutate: vi.fn(), ...overrides };
}

const billingTabMock = vi.fn();

vi.mock('../hooks/use-billing', () => ({
  useBillingTab: () => billingTabMock(),
}));

vi.mock('../usage-dashboard-container', () => ({
  UsageDashboardContainer: () => <div data-testid="usage-dashboard" />,
}));

vi.mock('../proration-preview-container', () => ({
  ProrationPreviewContainer: ({ onCancel }: { onCancel: () => void }) => (
    <div data-testid="proration-preview">
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  ),
}));

import { BillingTabContainer } from '../billing-tab-container';

type BillingTabHook = ReturnType<typeof useBillingTab>;

interface SetupArgs {
  subscription?: { tier?: string | null } | null | undefined;
  checkoutMutation?: Mutation;
  portalMutation?: Mutation;
}

function configureHook(args: SetupArgs = {}) {
  const checkoutMutation = args.checkoutMutation ?? makeMutation();
  const portalMutation = args.portalMutation ?? makeMutation();
  billingTabMock.mockReturnValue({
    subscription: args.subscription ?? null,
    checkoutMutation,
    portalMutation,
    t: (key: string) => (key === 'manageBilling' ? 'Manage billing' : key),
  } as unknown as BillingTabHook);
  return { checkoutMutation, portalMutation };
}

describe('BillingTabContainer (web-vite)', () => {
  it('renders the usage dashboard container', () => {
    configureHook();
    render(<BillingTabContainer />);
    expect(screen.getByTestId('usage-dashboard')).toBeInTheDocument();
  });

  it('does not show Manage billing when there is no subscription', () => {
    configureHook({ subscription: null });
    render(<BillingTabContainer />);
    expect(screen.queryByRole('button', { name: /manage billing/i })).not.toBeInTheDocument();
  });

  it('shows Manage billing when subscription exists', () => {
    configureHook({ subscription: { tier: 'PRO' } });
    render(<BillingTabContainer />);
    expect(screen.getByRole('button', { name: /manage billing/i })).toBeInTheDocument();
  });

  it('invokes portalMutation.mutate when Manage billing is clicked', async () => {
    const portalMutation = makeMutation();
    configureHook({ subscription: { tier: 'PRO' }, portalMutation });
    const { user } = setup(<BillingTabContainer />);
    await user.click(screen.getByRole('button', { name: /manage billing/i }));
    expect(portalMutation.mutate).toHaveBeenCalled();
  });

  it('does not render proration preview by default (no selectedPriceId)', () => {
    configureHook({ subscription: { tier: 'PRO' } });
    render(<BillingTabContainer />);
    expect(screen.queryByTestId('proration-preview')).not.toBeInTheDocument();
  });

  it('disables Manage billing while portal mutation is pending', () => {
    configureHook({
      subscription: { tier: 'PRO' },
      portalMutation: makeMutation({ isPending: true }),
    });
    render(<BillingTabContainer />);
    expect(screen.getByRole('button', { name: /manage billing/i })).toBeDisabled();
  });

  it('renders separator between sections', () => {
    configureHook({ subscription: { tier: 'PRO' } });
    const { container } = render(<BillingTabContainer />);
    expect(container.querySelectorAll("[data-slot='separator']").length).toBeGreaterThan(0);
  });
});
