/**
 * Container/component split — the section receives all derived state from
 * its hook (`portalSubdomain`, `subdomainError`, `handleSubdomainChange`,
 * `isDirty`, `handleSaveSubdomain`, `isPending`) plus three `t` namespaces.
 * Tests inject shaped stubs directly; validation and tRPC concerns are
 * covered by the hook test, not here.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';
import type { usePortalSubdomainSection } from '../hooks/use-portal-subdomain-section';
import { PortalSubdomainSectionView } from '../portal-subdomain-section';

type HookReturn = ReturnType<typeof usePortalSubdomainSection>;

const tStub = ((key: string) => key) as unknown as HookReturn['t'];

function buildHook(overrides: Partial<HookReturn> = {}): HookReturn {
  return {
    id: 'portal-section',
    t: tStub,
    tSettings: tStub,
    tAria: tStub,
    portalSubdomain: '',
    subdomainError: null,
    handleSubdomainChange: vi.fn(),
    isDirty: false,
    handleSaveSubdomain: vi.fn(),
    isPending: false,
    ...overrides,
  } as HookReturn;
}

describe('PortalSubdomainSectionView', () => {
  it('renders heading, description and save CTA', () => {
    render(<PortalSubdomainSectionView {...buildHook()} />);

    expect(screen.getByText('subdomainHeading')).toBeInTheDocument();
    expect(screen.getByText('subdomainCardDescription')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /saveCta/i })).toBeInTheDocument();
  });

  it('reflects the portalSubdomain hook value in the input', () => {
    render(<PortalSubdomainSectionView {...buildHook({ portalSubdomain: 'acme' })} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('acme');
  });

  it('disables the save button when not dirty', () => {
    render(<PortalSubdomainSectionView {...buildHook({ isDirty: false })} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('enables the save button when dirty and not pending', () => {
    render(<PortalSubdomainSectionView {...buildHook({ isDirty: true })} />);
    expect(screen.getByRole('button')).toBeEnabled();
  });

  it('renders an inline error message when subdomainError is provided', () => {
    render(<PortalSubdomainSectionView {...buildHook({ subdomainError: 'Subdomain too short' })} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Subdomain too short');
  });

  it('renders the spinner and saving label while pending', () => {
    const { container } = render(
      <PortalSubdomainSectionView {...buildHook({ isDirty: true, isPending: true })} />,
    );

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.getByText('saving')).toBeInTheDocument();
  });

  it('calls handleSubdomainChange as the user types', async () => {
    const handleSubdomainChange = vi.fn();
    const { user } = setup(<PortalSubdomainSectionView {...buildHook({ handleSubdomainChange })} />);

    await user.type(screen.getByRole('textbox'), 'a');
    expect(handleSubdomainChange).toHaveBeenCalledWith('a');
  });

  it('calls handleSaveSubdomain when the save button is clicked', async () => {
    const handleSaveSubdomain = vi.fn();
    const { user } = setup(
      <PortalSubdomainSectionView {...buildHook({ isDirty: true, handleSaveSubdomain })} />,
    );

    await user.click(screen.getByRole('button', { name: /saveCta/i }));
    expect(handleSaveSubdomain).toHaveBeenCalledTimes(1);
  });
});
