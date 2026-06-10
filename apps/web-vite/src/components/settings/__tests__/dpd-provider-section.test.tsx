/**
 * Presentational card receives `t`, `tCarriers`, `configOpen`, `isLoading`,
 * `isConfigured` from `useDpdProviderSection`. The configure dialog
 * mounts `CarrierCredentialForm`, which hits tRPC at runtime —
 * stubbed here so the test focuses on the card surface.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../carrier-credential-form', () => ({
  CarrierCredentialForm: () => null,
}));

import { render, screen, setup } from '@/test/test-utils';
import { DpdProviderSectionSkeleton, DpdProviderSectionView } from '../dpd-provider-section';
import type { useDpdProviderSection } from '../hooks/use-dpd-provider-section';

type HookReturn = ReturnType<typeof useDpdProviderSection>;

const tStub = ((key: string) => key) as unknown as HookReturn['t'];

function buildHook(overrides: Partial<HookReturn> = {}): HookReturn {
  return {
    t: tStub,
    tCarriers: tStub,
    configOpen: false,
    setConfigOpen: vi.fn(),
    isLoading: false,
    isConfigured: false,
    ...overrides,
  } as HookReturn;
}

describe('DpdProviderSectionView', () => {
  it('renders skeletons via the Skeleton sibling export', () => {
    const { container } = render(<DpdProviderSectionSkeleton />);

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByText('DPD')).not.toBeInTheDocument();
  });

  it('renders the DPD heading, description and not-configured badge by default', () => {
    render(<DpdProviderSectionView {...buildHook()} />);

    expect(screen.getByText('DPD')).toBeInTheDocument();
    expect(screen.getByText('notConfigured')).toBeInTheDocument();
    expect(screen.getByText('dpdDescription')).toBeInTheDocument();
  });

  it('renders the connected badge when isConfigured is true', () => {
    render(<DpdProviderSectionView {...buildHook({ isConfigured: true })} />);
    expect(screen.getByText('connected')).toBeInTheDocument();
    expect(screen.queryByText('notConfigured')).not.toBeInTheDocument();
  });

  it('opens the configure dialog when the configure button is clicked', async () => {
    const setConfigOpen = vi.fn();
    const { user } = setup(<DpdProviderSectionView {...buildHook({ setConfigOpen })} />);

    await user.click(screen.getByRole('button', { name: 'configureDpd' }));
    expect(setConfigOpen).toHaveBeenCalledWith(true);
  });
});
