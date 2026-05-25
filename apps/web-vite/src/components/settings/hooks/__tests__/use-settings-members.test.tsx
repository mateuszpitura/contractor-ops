/**
 * `useSettingsMembers` — owns the invite-dialog open state plus the
 * `member:create` permission gate for the members page header.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const usePermissionsMock = vi.fn();

vi.mock('../../../../hooks/use-permissions.js', () => ({
  usePermissions: () => usePermissionsMock(),
}));

import { act, renderHookWithProviders } from '../../../../test-utils/render-hook.js';
import { useSettingsMembers } from '../use-settings-members.js';

describe('useSettingsMembers', () => {
  beforeEach(() => {
    usePermissionsMock.mockReset();
  });

  it('initial state: invite dialog closed, canInvite from permissions', () => {
    usePermissionsMock.mockReturnValue({ can: () => true });
    const { result } = renderHookWithProviders(() => useSettingsMembers());
    expect(result.current.inviteOpen).toBe(false);
    expect(result.current.canInvite).toBe(true);
  });

  it('openInvite() flips inviteOpen to true', () => {
    usePermissionsMock.mockReturnValue({ can: () => true });
    const { result } = renderHookWithProviders(() => useSettingsMembers());
    act(() => result.current.openInvite());
    expect(result.current.inviteOpen).toBe(true);
  });

  it('setInviteOpen(false) closes the dialog', () => {
    usePermissionsMock.mockReturnValue({ can: () => true });
    const { result } = renderHookWithProviders(() => useSettingsMembers());
    act(() => result.current.openInvite());
    act(() => result.current.setInviteOpen(false));
    expect(result.current.inviteOpen).toBe(false);
  });

  it('canInvite=false when member:create is denied', () => {
    const can = vi.fn().mockReturnValue(false);
    usePermissionsMock.mockReturnValue({ can });
    const { result } = renderHookWithProviders(() => useSettingsMembers());
    expect(result.current.canInvite).toBe(false);
    expect(can).toHaveBeenCalledWith('member', ['create']);
  });
});
