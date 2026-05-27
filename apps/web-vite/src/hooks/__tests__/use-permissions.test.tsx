/**
 * `usePermissions` RBAC matrix smoke — exercises the matrix lookups against
 * a mocked Better Auth session + organization client. Web-vite shape: the
 * session payload carries `activeOrganizationId` but not the member row,
 * so the hook fetches role via `auth.organization.getActiveMember()` and
 * caches it through React Query.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseSession = vi.fn<() => { isPending: boolean; data: unknown }>();
const mockGetActiveMember = vi.fn<() => Promise<{ data: unknown; error: unknown }>>();

vi.mock('../../providers/auth-provider.js', () => ({
  useAuth: () => ({
    useSession: () => mockUseSession(),
    organization: { getActiveMember: mockGetActiveMember },
  }),
}));

import { usePermissions } from '../use-permissions.js';

function sessionFor(role: string | null, extraUser?: Record<string, unknown>) {
  if (role === null) {
    return {
      isPending: false,
      data: { session: { token: 't', activeOrganizationId: 'org_1' }, user: extraUser ?? {} },
    };
  }
  return {
    isPending: false,
    data: { session: { token: 't', activeOrganizationId: 'org_1' }, user: extraUser ?? {} },
  };
}

function configureMember(role: string | null) {
  mockGetActiveMember.mockResolvedValue({
    data: role === null ? null : { id: 'm1', role },
    error: null,
  });
}

function wrapper({ children }: { children: ReactNode }) {
  // Fresh QueryClient per render keeps cache hits from leaking between
  // cases — each test asserts a single role transition end-to-end.
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

async function renderWithRole(role: string | null, sessionExtraUser?: Record<string, unknown>) {
  mockUseSession.mockReturnValue(sessionFor(role, sessionExtraUser));
  configureMember(role);
  const view = renderHook(() => usePermissions(), { wrapper });
  await waitFor(() => expect(view.result.current.role).toBe(role ?? undefined));
  return view;
}

describe('usePermissions', () => {
  beforeEach(() => {
    mockUseSession.mockReset();
    mockGetActiveMember.mockReset();
  });

  it('finance_admin can approve invoices', async () => {
    const { result } = await renderWithRole('finance_admin');
    expect(result.current.can('invoice', ['approve'])).toBe(true);
  });

  it('finance_admin cannot create contractors', async () => {
    const { result } = await renderWithRole('finance_admin');
    expect(result.current.can('contractor', ['create'])).toBe(false);
  });

  it('returns false when role is missing', async () => {
    mockUseSession.mockReturnValue(sessionFor(null));
    configureMember(null);
    const { result } = renderHook(() => usePermissions(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.can('invoice', ['read'])).toBe(false);
  });

  it('owner can manage equipment', async () => {
    const { result } = await renderWithRole('owner');
    expect(result.current.can('equipment', ['delete'])).toBe(true);
  });

  it('exposes role, isLoading=true while session pending, and platform admin', async () => {
    // When the Better Auth session itself is still loading we should
    // surface `isLoading=true` even before the member query has had a
    // chance to fire. The user.role admin claim should still resolve
    // from the session blob — it does not require the member fetch.
    mockUseSession.mockReturnValue({
      isPending: true,
      data: {
        session: { token: null, activeOrganizationId: null },
        user: { role: 'admin' },
      },
    });
    configureMember(null);
    const { result } = renderHook(() => usePermissions(), { wrapper });
    expect(result.current.isPlatformAdmin).toBe(true);
    expect(result.current.isLoading).toBe(true);
  });

  it('unknown role denies everything', async () => {
    const { result } = await renderWithRole('unknown_role');
    expect(result.current.can('invoice', ['read'])).toBe(false);
  });

  it('every action in the list must be granted', async () => {
    const { result } = await renderWithRole('team_manager');
    // team_manager has invoice: read, approve — NOT update
    expect(result.current.can('invoice', ['read', 'approve'])).toBe(true);
    expect(result.current.can('invoice', ['read', 'update'])).toBe(false);
  });
});
