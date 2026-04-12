import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { DashboardProvider, useDashboardContext } from '../dashboard-context';

describe('DashboardProvider', () => {
  it('provides activeOrg and userRole', () => {
    const org = { id: 'org-1', name: 'Test Org', slug: 'test-org', logo: null };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DashboardProvider activeOrg={org} userRole="ORG_ADMIN">
        {children}
      </DashboardProvider>
    );

    const { result } = renderHook(() => useDashboardContext(), { wrapper });
    expect(result.current.activeOrg?.name).toBe('Test Org');
    expect(result.current.userRole).toBe('ORG_ADMIN');
  });

  it('provides null defaults without provider', () => {
    const { result } = renderHook(() => useDashboardContext());
    expect(result.current.activeOrg).toBeNull();
    expect(result.current.userRole).toBeNull();
  });
});
