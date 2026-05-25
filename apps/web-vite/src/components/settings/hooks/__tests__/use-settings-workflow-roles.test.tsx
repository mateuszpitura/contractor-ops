/**
 * `useSettingsWorkflowRoles` — owns the create-dialog open state plus
 * the `workflow:create` permission gate for the workflow-roles page.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const usePermissionsMock = vi.fn();

vi.mock('../../../../hooks/use-permissions.js', () => ({
  usePermissions: () => usePermissionsMock(),
}));

import { act, renderHookWithProviders } from '../../../../test-utils/render-hook.js';
import { useSettingsWorkflowRoles } from '../use-settings-workflow-roles.js';

describe('useSettingsWorkflowRoles', () => {
  beforeEach(() => {
    usePermissionsMock.mockReset();
  });

  it('initial state: create dialog closed, canCreate from permissions', () => {
    usePermissionsMock.mockReturnValue({ can: () => true });
    const { result } = renderHookWithProviders(() => useSettingsWorkflowRoles());
    expect(result.current.createOpen).toBe(false);
    expect(result.current.canCreate).toBe(true);
  });

  it('openCreate() flips createOpen to true', () => {
    usePermissionsMock.mockReturnValue({ can: () => true });
    const { result } = renderHookWithProviders(() => useSettingsWorkflowRoles());
    act(() => result.current.openCreate());
    expect(result.current.createOpen).toBe(true);
  });

  it('setCreateOpen(false) closes the dialog', () => {
    usePermissionsMock.mockReturnValue({ can: () => true });
    const { result } = renderHookWithProviders(() => useSettingsWorkflowRoles());
    act(() => result.current.openCreate());
    act(() => result.current.setCreateOpen(false));
    expect(result.current.createOpen).toBe(false);
  });

  it('canCreate=false when workflow:create is denied', () => {
    const can = vi.fn().mockReturnValue(false);
    usePermissionsMock.mockReturnValue({ can });
    const { result } = renderHookWithProviders(() => useSettingsWorkflowRoles());
    expect(result.current.canCreate).toBe(false);
    expect(can).toHaveBeenCalledWith('workflow', ['create']);
  });
});
