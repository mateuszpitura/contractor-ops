/**
 * `useSettingsPayments` — gates the `/settings/payments` (BACS) page on
 * the `settings:update` permission and the `payments.bacs-enabled` flag.
 * Pure derivation, no tRPC.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const usePermissionsMock = vi.fn();
const useFlagMock = vi.fn();

vi.mock('../../../../hooks/use-permissions.js', () => ({
  usePermissions: () => usePermissionsMock(),
}));

vi.mock('../../../layout/feature-flag-context.js', () => ({
  useFlag: (key: string) => useFlagMock(key),
}));

import { renderHookWithProviders } from '../../../../test-utils/render-hook.js';
import { useSettingsPayments } from '../use-settings-payments.js';

describe('useSettingsPayments', () => {
  beforeEach(() => {
    usePermissionsMock.mockReset();
    useFlagMock.mockReset();
    useFlagMock.mockReturnValue(false);
  });

  it('denies management when the settings:update permission is missing', () => {
    usePermissionsMock.mockReturnValue({ can: () => false });
    const { result } = renderHookWithProviders(() => useSettingsPayments());
    expect(result.current.canManageSettings).toBe(false);
    expect(result.current.bacsEnabled).toBe(false);
  });

  it('grants management on settings:update and surfaces the flag value', () => {
    const can = vi.fn().mockReturnValue(true);
    usePermissionsMock.mockReturnValue({ can });
    useFlagMock.mockReturnValue(true);
    const { result } = renderHookWithProviders(() => useSettingsPayments());
    expect(result.current.canManageSettings).toBe(true);
    expect(result.current.bacsEnabled).toBe(true);
    expect(can).toHaveBeenCalledWith('settings', ['update']);
  });

  it('reads from the `payments.bacs-enabled` flag specifically', () => {
    usePermissionsMock.mockReturnValue({ can: () => true });
    renderHookWithProviders(() => useSettingsPayments());
    expect(useFlagMock).toHaveBeenCalledWith('payments.bacs-enabled');
  });

  it('returns canManageSettings=true with bacsEnabled=false when flag is off', () => {
    usePermissionsMock.mockReturnValue({ can: () => true });
    useFlagMock.mockReturnValue(false);
    const { result } = renderHookWithProviders(() => useSettingsPayments());
    expect(result.current).toEqual({ canManageSettings: true, bacsEnabled: false });
  });
});
