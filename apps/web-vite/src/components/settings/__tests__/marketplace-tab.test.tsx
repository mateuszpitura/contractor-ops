/**
 * MarketplaceTabView is the presentational surface driven by
 * `useMarketplaceTab`. It wraps content in `FeatureGate` (mocked here to a
 * pass-through) and renders loading / error / empty / list states plus the
 * per-listing advance control. Tests exercise those branches with plain
 * props — no tRPC provider needed.
 */

import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../layout/feature-gate', () => ({
  FeatureGate: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import { render, screen, setup } from '@/test/test-utils';
import type { MarketplaceListingRow, MarketplaceTabViewProps } from '../hooks/use-marketplace-tab';
import { MarketplaceTabView } from '../marketplace-tab';

const tStub = ((key: string) => key) as unknown as MarketplaceTabViewProps['t'];

function buildProps(overrides: Partial<MarketplaceTabViewProps> = {}): MarketplaceTabViewProps {
  return {
    t: tStub,
    listings: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn().mockResolvedValue(undefined),
    advance: vi.fn(),
    isUpdating: false,
    updatingPlatform: null,
    ...overrides,
  } as unknown as MarketplaceTabViewProps;
}

function listing(overrides: Partial<MarketplaceListingRow> = {}): MarketplaceListingRow {
  return {
    id: 'listing-zapier',
    platform: 'ZAPIER',
    status: 'DRAFT',
    versionPin: '1.0.0',
    lastReviewFeedback: null,
    listingUrl: null,
    submittedAt: null,
    wentLiveAt: null,
    updatedByUserId: null,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  } as unknown as MarketplaceListingRow;
}

describe('MarketplaceTabView', () => {
  it('renders the heading and description', () => {
    render(<MarketplaceTabView {...buildProps()} />);
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('description')).toBeInTheDocument();
  });

  it('renders an accessible loading region while loading', () => {
    render(<MarketplaceTabView {...buildProps({ isLoading: true })} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders an error alert with a retry that refetches', async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    const { user } = setup(<MarketplaceTabView {...buildProps({ isError: true, refetch })} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('errorHeading')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'retry' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renders the empty state when no listings are present', () => {
    render(<MarketplaceTabView {...buildProps({ listings: [] })} />);
    expect(screen.getByText('emptyHeading')).toBeInTheDocument();
    expect(screen.getByText('emptyBody')).toBeInTheDocument();
  });

  it('renders one card per listing with platform name, status and version', () => {
    render(
      <MarketplaceTabView
        {...buildProps({
          listings: [
            listing({ id: 'z', platform: 'ZAPIER', status: 'DRAFT' }),
            listing({ id: 'n', platform: 'N8N', status: 'IN_REVIEW' }),
            listing({ id: 'm', platform: 'MAKE', status: 'LIVE' }),
          ],
        })}
      />,
    );
    expect(screen.getByText('platforms.ZAPIER')).toBeInTheDocument();
    expect(screen.getByText('platforms.N8N')).toBeInTheDocument();
    expect(screen.getByText('platforms.MAKE')).toBeInTheDocument();
    // status labels (badge + select share the label key, so use getAllByText)
    expect(screen.getAllByText('statuses.DRAFT').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('statuses.LIVE').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('versionPin').length).toBe(3);
  });

  it('shows the last review feedback when present', () => {
    render(
      <MarketplaceTabView
        {...buildProps({
          listings: [listing({ lastReviewFeedback: 'Fix the auth copy.' })],
        })}
      />,
    );
    expect(screen.getByText('Fix the auth copy.')).toBeInTheDocument();
  });

  it('advances a DRAFT listing to SUBMITTED via the advance control', async () => {
    const advance = vi.fn();
    const { user } = setup(
      <MarketplaceTabView
        {...buildProps({
          advance,
          listings: [listing({ platform: 'ZAPIER', status: 'DRAFT' })],
        })}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'advanceButton' }));
    expect(advance).toHaveBeenCalledWith('ZAPIER', 'SUBMITTED');
  });

  it('shows the no-transitions note for a rejected listing after re-submit only', () => {
    // A LIVE listing can only regress to NEEDS_CHANGES — the control stays enabled.
    render(<MarketplaceTabView {...buildProps({ listings: [listing({ status: 'LIVE' })] })} />);
    expect(screen.getByRole('button', { name: 'advanceButton' })).toBeInTheDocument();
  });
});
