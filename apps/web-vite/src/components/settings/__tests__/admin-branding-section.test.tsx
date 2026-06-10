/**
 * Container/component split — the section receives `t`, `tSettings`,
 * `fileInputRef`, branding query state and save handlers from its hook.
 * Tests inject shaped stubs directly; tRPC/upload concerns belong to the
 * hook test, not here.
 */

import type { RefObject } from 'react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '@/test/test-utils';
import { AdminBrandingSectionView } from '../admin-branding-section';
import type { useAdminBrandingSection } from '../hooks/use-admin-branding-section';

type HookReturn = ReturnType<typeof useAdminBrandingSection>;

const tStub = ((key: string) => key) as unknown as HookReturn['t'];

function buildHook(overrides: Partial<HookReturn> = {}): HookReturn {
  const fileInputRef = createRef<HTMLInputElement>() as RefObject<HTMLInputElement>;
  return {
    t: tStub,
    tSettings: tStub,
    fileInputRef,
    brandColor: '#4f46e5',
    setBrandColor: vi.fn(),
    logoPreview: null,
    uploading: false,
    brandingQuery: { isLoading: false } as HookReturn['brandingQuery'],
    handleFileSelect: vi.fn(),
    handleRemoveLogo: vi.fn(),
    isDirty: false,
    handleSave: vi.fn(),
    isSavePending: false,
    ...overrides,
  } as HookReturn;
}

describe('AdminBrandingSectionView', () => {
  it('renders the loading skeleton while brandingQuery.isLoading is true', () => {
    const { container } = render(
      <AdminBrandingSectionView
        {...buildHook({
          brandingQuery: { isLoading: true } as HookReturn['brandingQuery'],
        })}
      />,
    );

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByText('heading')).not.toBeInTheDocument();
  });

  it('renders heading, description and upload affordance once loaded', () => {
    render(<AdminBrandingSectionView {...buildHook()} />);

    expect(screen.getByText('heading')).toBeInTheDocument();
    expect(screen.getByText('description')).toBeInTheDocument();
    expect(screen.getByText('uploadLogo')).toBeInTheDocument();
  });

  it('renders the logo preview and remove control when a logo is set', () => {
    render(
      <AdminBrandingSectionView
        {...buildHook({ logoPreview: 'https://cdn.example.com/logo.png' })}
      />,
    );

    expect(screen.getByRole('img', { name: 'logoAlt' })).toHaveAttribute(
      'src',
      expect.stringContaining('logo.png'),
    );
    expect(screen.getByText('removeLogo')).toBeInTheDocument();
  });

  it('disables save while not dirty and enables it once dirty', () => {
    const { rerender } = render(<AdminBrandingSectionView {...buildHook({ isDirty: false })} />);
    expect(screen.getByRole('button', { name: /saveCta/i })).toBeDisabled();

    rerender(<AdminBrandingSectionView {...buildHook({ isDirty: true })} />);
    expect(screen.getByRole('button', { name: /saveCta/i })).toBeEnabled();
  });

  it('shows the saving label and spinner while isSavePending', () => {
    const { container } = render(
      <AdminBrandingSectionView {...buildHook({ isDirty: true, isSavePending: true })} />,
    );

    expect(screen.getByText('saving')).toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('fires handleSave when the save button is clicked', async () => {
    const handleSave = vi.fn();
    const { user } = setup(
      <AdminBrandingSectionView {...buildHook({ isDirty: true, handleSave })} />,
    );

    await user.click(screen.getByRole('button', { name: /saveCta/i }));
    expect(handleSave).toHaveBeenCalledTimes(1);
  });

  it('fires handleRemoveLogo when the remove control is clicked', async () => {
    const handleRemoveLogo = vi.fn();
    const { user } = setup(
      <AdminBrandingSectionView
        {...buildHook({ logoPreview: 'https://cdn.example.com/logo.png', handleRemoveLogo })}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'removeLogo' }));
    expect(handleRemoveLogo).toHaveBeenCalledTimes(1);
  });
});
