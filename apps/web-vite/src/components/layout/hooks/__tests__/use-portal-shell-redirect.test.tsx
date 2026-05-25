/**
 * `usePortalShellRedirect` — side-effect-only hook. Covers:
 *   - shouldRedirect=false → no navigate call
 *   - shouldRedirect=true → navigate to portal login with replace
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../../../i18n/navigation.js', () => ({
  useLocale: () => 'en',
  localePath: (path: string, locale: string) => `/${locale}${path}`,
}));

import { renderHookWithProviders } from '../../../../test-utils/render-hook.js';
import { usePortalShellRedirect } from '../use-portal-shell-redirect.js';

beforeEach(() => {
  navigateMock.mockReset();
});

describe('usePortalShellRedirect', () => {
  it('does not navigate when shouldRedirect is false (idle branch)', () => {
    renderHookWithProviders(() => usePortalShellRedirect(false));
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('navigates to /:locale/portal/login with replace when shouldRedirect flips true', () => {
    renderHookWithProviders(() => usePortalShellRedirect(true));
    expect(navigateMock).toHaveBeenCalledWith('/en/portal/login', { replace: true });
  });
});
