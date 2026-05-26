/**
 * Web-vite port of apps/web/src/components/settings/__tests__/ups-provider-section.test.tsx.
 *
 * Mirror of `dpd-provider-section.test.tsx` — same shape, UPS-specific keys.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../carrier-credential-form-container', () => ({
  CarrierCredentialFormContainer: () => null,
}));

import { render, screen, setup } from '@/test/test-utils';
import type { useUpsProviderSection } from '../hooks/use-ups-provider-section';
import { UpsProviderSection, UpsProviderSectionSkeleton } from '../ups-provider-section';

type HookReturn = ReturnType<typeof useUpsProviderSection>;

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

describe('UpsProviderSection', () => {
  it('renders skeletons via the Skeleton sibling export', () => {
    const { container } = render(<UpsProviderSectionSkeleton />);

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByText('UPS')).not.toBeInTheDocument();
  });

  it('renders the UPS heading, description and not-configured badge by default', () => {
    render(<UpsProviderSection {...buildHook()} />);

    expect(screen.getByText('UPS')).toBeInTheDocument();
    expect(screen.getByText('notConfigured')).toBeInTheDocument();
    expect(screen.getByText('upsDescription')).toBeInTheDocument();
  });

  it('renders the connected badge when isConfigured is true', () => {
    render(<UpsProviderSection {...buildHook({ isConfigured: true })} />);
    expect(screen.getByText('connected')).toBeInTheDocument();
    expect(screen.queryByText('notConfigured')).not.toBeInTheDocument();
  });

  it('opens the configure dialog when the configure button is clicked', async () => {
    const setConfigOpen = vi.fn();
    const { user } = setup(<UpsProviderSection {...buildHook({ setConfigOpen })} />);

    await user.click(screen.getByRole('button', { name: 'configureUps' }));
    expect(setConfigOpen).toHaveBeenCalledWith(true);
  });
});
