/**
 * `useSettingsTax` — permission gate for `/settings/tax`. Covers the
 * loading bypass (canView is forgiving while permissions resolve),
 * the deny path, the allow path, and the locale-aware unauthorized href.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const usePermissionsMock = vi.fn();
const useLocaleMock = vi.fn();

vi.mock('../../../../hooks/use-permissions.js', () => ({
  usePermissions: () => usePermissionsMock(),
}));

vi.mock('../../../../i18n/navigation.js', () => ({
  useLocale: () => useLocaleMock(),
}));

import { renderHookWithProviders } from '../../../../test-utils/render-hook.js';
import { useSettingsTax } from '../use-settings-tax.js';

describe('useSettingsTax', () => {
  beforeEach(() => {
    usePermissionsMock.mockReset();
    useLocaleMock.mockReset();
    useLocaleMock.mockReturnValue('en');
  });

  it('canView=true while permissions are still loading (avoid flash-redirect)', () => {
    usePermissionsMock.mockReturnValue({ can: () => false, isLoading: true });
    const { result } = renderHookWithProviders(() => useSettingsTax());
    expect(result.current.canView).toBe(true);
    expect(result.current.isLoading).toBe(true);
  });

  it('canView=false when permission is denied and not loading', () => {
    usePermissionsMock.mockReturnValue({ can: () => false, isLoading: false });
    const { result } = renderHookWithProviders(() => useSettingsTax());
    expect(result.current.canView).toBe(false);
  });

  it('canView=true when settings:read is granted', () => {
    const can = vi.fn().mockReturnValue(true);
    usePermissionsMock.mockReturnValue({ can, isLoading: false });
    const { result } = renderHookWithProviders(() => useSettingsTax());
    expect(result.current.canView).toBe(true);
    expect(can).toHaveBeenCalledWith('settings', ['read']);
  });

  it('builds the unauthorized href against the active locale', () => {
    usePermissionsMock.mockReturnValue({ can: () => false, isLoading: false });
    useLocaleMock.mockReturnValue('de');
    const { result } = renderHookWithProviders(() => useSettingsTax());
    expect(result.current.unauthorizedHref).toBe('/de/unauthorized');
  });
});
