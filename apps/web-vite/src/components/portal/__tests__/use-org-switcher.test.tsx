import { describe, expect, it, vi } from 'vitest';

import {
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from './render-portal-hook.js';

vi.mock('../../../providers/trpc-provider.js', () => {
  const trpc = createTRPCProxy();
  return { useTRPC: () => trpc, usePortalTRPC: () => trpc };
});

const { useOrgSwitcher } = await import('../hooks/use-org-switcher.js');

describe('useOrgSwitcher', () => {
  it('loading: pending while orgs query unresolved', () => {
    setTRPCMock({
      'portal.listMyOrgs': () => new Promise(() => undefined),
      'portal.switchOrg': () => ({}),
    });
    const { result } = renderHookWithProviders(() => useOrgSwitcher());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.orgs).toEqual([]);
    clearTRPCMock();
  });

  it('empty: single-org user has isAvailable=false', async () => {
    setTRPCMock({
      'portal.listMyOrgs': () => [
        {
          contractorId: 'c1',
          organizationId: 'o1',
          orgName: 'Org A',
          orgLogo: null,
          isCurrent: true,
        },
      ],
      'portal.switchOrg': () => ({}),
    });
    const { result } = renderHookWithProviders(() => useOrgSwitcher());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAvailable).toBe(false);
    clearTRPCMock();
  });

  it('error: orgs stays empty when query throws', async () => {
    setTRPCMock({
      'portal.listMyOrgs': () => {
        throw new Error('boom');
      },
      'portal.switchOrg': () => ({}),
    });
    const { result } = renderHookWithProviders(() => useOrgSwitcher());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.orgs).toEqual([]);
    clearTRPCMock();
  });

  it('success: multi-org user has isAvailable=true', async () => {
    setTRPCMock({
      'portal.listMyOrgs': () => [
        {
          contractorId: 'c1',
          organizationId: 'o1',
          orgName: 'Org A',
          orgLogo: null,
          isCurrent: true,
        },
        {
          contractorId: 'c2',
          organizationId: 'o2',
          orgName: 'Org B',
          orgLogo: null,
          isCurrent: false,
        },
      ],
      'portal.switchOrg': () => ({}),
    });
    const { result } = renderHookWithProviders(() => useOrgSwitcher());
    await waitFor(() => expect(result.current.orgs.length).toBe(2));
    expect(result.current.isAvailable).toBe(true);
    expect(result.current.switchingContractorId).toBeNull();
    clearTRPCMock();
  });
});
