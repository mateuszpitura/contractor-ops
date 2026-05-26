/**
 * `usePermissions` RBAC matrix smoke — exercises the matrix lookups against
 * a mocked Better Auth session. Web-vite shape: role lives at
 * `session.data.member.role` (not on a server context).
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseSession = vi.fn<() => { isPending: boolean; data: unknown }>();

vi.mock('../../providers/auth-provider.js', () => ({
  useAuth: () => ({ useSession: () => mockUseSession() }),
}));

import { usePermissions } from '../use-permissions.js';

function sessionWith(role: string | null) {
  return {
    isPending: false,
    data: role === null ? { member: null } : { member: { role } },
  };
}

describe('usePermissions', () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue(sessionWith('finance_admin'));
  });

  it('finance_admin can approve invoices', () => {
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can('invoice', ['approve'])).toBe(true);
  });

  it('finance_admin cannot create contractors', () => {
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can('contractor', ['create'])).toBe(false);
  });

  it('returns false when role is missing', () => {
    mockUseSession.mockReturnValue(sessionWith(null));
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can('invoice', ['read'])).toBe(false);
  });

  it('owner can manage equipment', () => {
    mockUseSession.mockReturnValue(sessionWith('owner'));
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can('equipment', ['delete'])).toBe(true);
  });

  it('exposes role, isLoading, session passthrough', () => {
    mockUseSession.mockReturnValue({
      isPending: true,
      data: { member: { role: 'admin' }, user: { role: 'admin' } },
    });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.role).toBe('admin');
    expect(result.current.isPlatformAdmin).toBe(true);
    expect(result.current.isLoading).toBe(true);
  });

  it('unknown role denies everything', () => {
    mockUseSession.mockReturnValue(sessionWith('unknown_role'));
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can('invoice', ['read'])).toBe(false);
  });

  it('every action in the list must be granted', () => {
    mockUseSession.mockReturnValue(sessionWith('team_manager'));
    const { result } = renderHook(() => usePermissions());
    // team_manager has invoice: read, approve — NOT update
    expect(result.current.can('invoice', ['read', 'approve'])).toBe(true);
    expect(result.current.can('invoice', ['read', 'update'])).toBe(false);
  });
});
