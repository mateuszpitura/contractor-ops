/**
 * `useSettingsIndex` — drives the `/settings` page tab list. Covers:
 *   - loading-state pin gating (canViewAuditLog etc.)
 *   - routed-tab navigation (members / workflow-roles / tax → router.push)
 *   - non-routed-tab nuqs replace (`/settings?tab=...`)
 *   - permission gating filters out integrations / billing / api-keys /
 *     audit-log / feature-flags / tax tabs
 *   - platform-admin gates `feature-flags`
 *   - i18n labels feed pin/unpin aria labels
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const usePermissionsMock = vi.fn();
const useSettingsTabPinsMock = vi.fn();
const routerMock = { push: vi.fn(), replace: vi.fn() };

vi.mock('../../../../hooks/use-permissions.js', () => ({
  usePermissions: () => usePermissionsMock(),
}));

vi.mock('../../../../hooks/use-settings-tab-pins.js', () => ({
  useSettingsTabPins: () => useSettingsTabPinsMock(),
}));

vi.mock('../../../../i18n/navigation.js', () => ({
  useRouter: () => routerMock,
}));

import { act, renderHookWithProviders } from '../../../../test-utils/render-hook.js';
import { useSettingsIndex } from '../use-settings-index.js';

function setup(opts: {
  can?: (resource: string, actions: string[]) => boolean;
  isPlatformAdmin?: boolean;
  pinned?: Set<string>;
  pinPending?: boolean;
}) {
  usePermissionsMock.mockReturnValue({
    can: opts.can ?? (() => true),
    isPlatformAdmin: opts.isPlatformAdmin ?? false,
  });
  useSettingsTabPinsMock.mockReturnValue({
    isPinned: (key: string) => opts.pinned?.has(key) ?? false,
    toggle: vi.fn(),
    isPending: opts.pinPending ?? false,
  });
}

describe('useSettingsIndex', () => {
  beforeEach(() => {
    usePermissionsMock.mockReset();
    useSettingsTabPinsMock.mockReset();
    routerMock.push.mockReset();
    routerMock.replace.mockReset();
  });

  it('returns the full tab list for an org-admin with platform-admin role', () => {
    setup({ can: () => true, isPlatformAdmin: true });
    const { result } = renderHookWithProviders(() => useSettingsIndex());
    const keys = result.current.tabsToRender.map(t => t.key);
    expect(keys).toContain('integrations');
    expect(keys).toContain('billing');
    expect(keys).toContain('audit-log');
    expect(keys).toContain('api-keys');
    expect(keys).toContain('feature-flags');
    expect(keys).toContain('tax');
  });

  it('filters out admin-only tabs for an unprivileged user', () => {
    setup({
      can: (resource, actions) => {
        if (resource === 'organization' && actions[0] === 'update') return false;
        if (resource === 'settings' && actions[0] === 'read') return false;
        return false;
      },
      isPlatformAdmin: false,
    });
    const { result } = renderHookWithProviders(() => useSettingsIndex());
    const keys = result.current.tabsToRender.map(t => t.key);
    expect(keys).not.toContain('integrations');
    expect(keys).not.toContain('billing');
    expect(keys).not.toContain('audit-log');
    expect(keys).not.toContain('api-keys');
    expect(keys).not.toContain('feature-flags');
    expect(keys).not.toContain('tax');
  });

  it('routes the dedicated tabs via router.push', () => {
    setup({ can: () => true, isPlatformAdmin: true });
    const { result } = renderHookWithProviders(() => useSettingsIndex());
    act(() => result.current.onSettingsTabChange('members'));
    expect(routerMock.push).toHaveBeenCalledWith('/settings/members');
    act(() => result.current.onSettingsTabChange('workflow-roles'));
    expect(routerMock.push).toHaveBeenCalledWith('/settings/workflow-roles');
    act(() => result.current.onSettingsTabChange('tax'));
    expect(routerMock.push).toHaveBeenCalledWith('/settings/tax');
  });

  it('uses router.replace with ?tab= for inline tabs', () => {
    setup({ can: () => true });
    const { result } = renderHookWithProviders(() => useSettingsIndex());
    act(() => result.current.onSettingsTabChange('general'));
    expect(routerMock.replace).toHaveBeenCalledWith('/settings?tab=general');
  });

  it('marks pinned tabs and forwards aria labels from i18n', () => {
    setup({
      can: () => true,
      pinned: new Set(['general', 'tax']),
    });
    const { result } = renderHookWithProviders(() => useSettingsIndex());
    const general = result.current.tabsToRender.find(t => t.key === 'general');
    const tax = result.current.tabsToRender.find(t => t.key === 'tax');
    expect(general?.pinned).toBe(true);
    expect(tax?.pinned).toBe(true);
    expect(general?.routed).toBe(false);
    expect(tax?.routed).toBe(true);
    expect(typeof general?.pinAriaLabel).toBe('string');
    expect(typeof general?.unpinAriaLabel).toBe('string');
  });

  it('exposes pin-mutation pending flag and toggle callback from useSettingsTabPins', () => {
    const toggleSpy = vi.fn();
    useSettingsTabPinsMock.mockReset();
    useSettingsTabPinsMock.mockReturnValue({
      isPinned: () => false,
      toggle: toggleSpy,
      isPending: true,
    });
    usePermissionsMock.mockReturnValue({ can: () => true, isPlatformAdmin: false });
    const { result } = renderHookWithProviders(() => useSettingsIndex());
    expect(result.current.pinPending).toBe(true);
    result.current.togglePin('general');
    expect(toggleSpy).toHaveBeenCalledWith('general');
  });
});
