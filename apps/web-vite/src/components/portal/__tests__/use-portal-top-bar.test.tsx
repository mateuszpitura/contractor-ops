import { describe, expect, it, vi } from 'vitest';

import {
  act,
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
} from './render-portal-hook.js';

vi.mock('../../../providers/trpc-provider.js', () => {
  const trpc = createTRPCProxy();
  return { useTRPC: () => trpc, usePortalTRPC: () => trpc };
});

const { usePortalTopBar, usePortalMobileMenu } = await import('../hooks/use-portal-top-bar.js');

beforeEach(() => {
  // jsdom defaults — fetch shim for /api/portal/clear-session
  globalThis.fetch = vi.fn(async () => new Response(null, { status: 204 })) as never;
});

describe('usePortalTopBar', () => {
  it('loading: starts with closed mobile menu', () => {
    setTRPCMock({
      'portal.listMyOrgs': () => [],
      'portal.switchOrg': () => ({}),
      'portal.logout': () => ({}),
    });
    const { result } = renderHookWithProviders(() => usePortalTopBar());
    expect(result.current.mobileMenuOpen).toBe(false);
    clearTRPCMock();
  });

  it('empty: orgSwitcher.isAvailable false for solo-org user', () => {
    setTRPCMock({
      'portal.listMyOrgs': () => [],
      'portal.switchOrg': () => ({}),
      'portal.logout': () => ({}),
    });
    const { result } = renderHookWithProviders(() => usePortalTopBar());
    expect(result.current.orgSwitcher.isAvailable).toBe(false);
    clearTRPCMock();
  });

  it('success: setMobileMenuOpen flips state', () => {
    setTRPCMock({
      'portal.listMyOrgs': () => [],
      'portal.switchOrg': () => ({}),
      'portal.logout': () => ({}),
    });
    const { result } = renderHookWithProviders(() => usePortalTopBar());
    act(() => {
      result.current.setMobileMenuOpen(true);
    });
    expect(result.current.mobileMenuOpen).toBe(true);
    clearTRPCMock();
  });

  it('logout: calls clear-session endpoint', async () => {
    setTRPCMock({
      'portal.listMyOrgs': () => [],
      'portal.switchOrg': () => ({}),
      'portal.logout': () => ({}),
    });
    const { result } = renderHookWithProviders(() => usePortalTopBar());
    await act(async () => {
      await result.current.handleLogout();
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/portal\/clear-session$/),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    clearTRPCMock();
  });
});

describe('usePortalMobileMenu', () => {
  it('handleNavClick: closes drawer before navigation', () => {
    setTRPCMock({
      'portal.listMyOrgs': () => [],
      'portal.switchOrg': () => ({}),
    });
    const onOpenChange = vi.fn();
    const { result } = renderHookWithProviders(() => usePortalMobileMenu(onOpenChange));
    act(() => {
      result.current.handleNavClick('/portal/invoices');
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    clearTRPCMock();
  });

  it('handleLogout: closes drawer and calls clear-session', async () => {
    setTRPCMock({
      'portal.listMyOrgs': () => [],
      'portal.switchOrg': () => ({}),
    });
    const onOpenChange = vi.fn();
    const { result } = renderHookWithProviders(() => usePortalMobileMenu(onOpenChange));
    await act(async () => {
      await result.current.handleLogout();
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/portal\/clear-session$/),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    clearTRPCMock();
  });
});
