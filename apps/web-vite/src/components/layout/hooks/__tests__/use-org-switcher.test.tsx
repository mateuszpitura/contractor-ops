/**
 * `useOrgSwitcher` — sidebar OrgSwitcher view-model. Covers:
 *   - empty list → no organizations
 *   - success → organization list shape forwarded
 *   - current org comes from DashboardContext (not auth)
 *   - handleOrgSwitch → calls auth.organization.setActive then reloads
 */

import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const listOrgsState: { data: Array<{ id: string; name: string }> | null } = { data: null };
const setActiveMock = vi.fn<(args: { organizationId: string }) => Promise<void>>();
const reloadMock = vi.fn();

vi.mock('../../../../providers/auth-provider.js', () => ({
  useAuth: () => ({
    useListOrganizations: () => listOrgsState,
    organization: {
      setActive: (args: { organizationId: string }) => setActiveMock(args),
    },
  }),
}));

vi.mock('../../dashboard-context.js', async () => {
  const React = await import('react');
  return {
    useDashboardContext: () => ({
      activeOrg: { id: 'org-1', name: 'Acme', slug: 'acme', logo: null },
      userRole: 'admin',
    }),
    DashboardProvider: ({ children }: { children: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

import { act, renderHookWithProviders } from '../../../../test-utils/render-hook.js';
import { useOrgSwitcher } from '../use-org-switcher.js';

const originalLocation = window.location;

beforeEach(() => {
  listOrgsState.data = null;
  setActiveMock.mockReset();
  setActiveMock.mockResolvedValue(undefined);
  reloadMock.mockReset();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, reload: reloadMock },
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
});

describe('useOrgSwitcher', () => {
  it('returns an empty organizations list when auth has not resolved (loading branch)', () => {
    listOrgsState.data = null;
    const { result } = renderHookWithProviders(() => useOrgSwitcher());
    expect(result.current.organizations).toEqual([]);
  });

  it('returns an empty list when the user belongs to no organizations (empty)', () => {
    listOrgsState.data = [];
    const { result } = renderHookWithProviders(() => useOrgSwitcher());
    expect(result.current.organizations).toEqual([]);
  });

  it('maps the organization list to {id, name} entries on success', () => {
    listOrgsState.data = [
      { id: 'org-1', name: 'Acme' },
      { id: 'org-2', name: 'Globex' },
    ];
    const { result } = renderHookWithProviders(() => useOrgSwitcher());
    expect(result.current.organizations).toEqual([
      { id: 'org-1', name: 'Acme' },
      { id: 'org-2', name: 'Globex' },
    ]);
  });

  it('forwards currentOrg from DashboardContext (not from auth)', () => {
    listOrgsState.data = [{ id: 'org-2', name: 'Globex' }];
    const { result } = renderHookWithProviders(() => useOrgSwitcher());
    expect(result.current.currentOrg?.id).toBe('org-1');
    expect(result.current.currentOrg?.name).toBe('Acme');
  });

  it('handleOrgSwitch calls auth.organization.setActive then reloads the page', async () => {
    listOrgsState.data = [{ id: 'org-2', name: 'Globex' }];
    const { result } = renderHookWithProviders(() => useOrgSwitcher());
    await act(async () => {
      await result.current.handleOrgSwitch('org-2');
    });
    expect(setActiveMock).toHaveBeenCalledWith({ organizationId: 'org-2' });
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });
});
