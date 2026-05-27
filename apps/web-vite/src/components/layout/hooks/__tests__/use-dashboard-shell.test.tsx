/**
 * `useDashboardShell` — top-level dashboard shell view-model. Covers:
 *   - loading: session pending → isLoading=true, activeOrg=null
 *   - empty: no activeOrganizationId → isLoading=false, activeOrg=null
 *   - success: org + ToS resolve → activeOrg populated, needsTosAcceptance=false
 *   - ToS unaccepted → needsTosAcceptance=true
 *   - memberRole forwarded from session payload
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const sessionState: { data: unknown; isPending: boolean } = { data: null, isPending: false };
const mockGetActiveMember = vi.fn<() => Promise<{ data: unknown; error: unknown }>>();

vi.mock('../../../../providers/auth-provider.js', () => ({
  useAuth: () => ({
    useSession: () => sessionState,
    organization: { getActiveMember: mockGetActiveMember },
  }),
}));

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

import {
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useDashboardShell } from '../use-dashboard-shell.js';

const trpcProxy = createTRPCProxy();

beforeEach(() => {
  sessionState.data = null;
  sessionState.isPending = false;
  setTRPCMock({});
  // Default: no active member resolved. Individual tests override before
  // rendering when they assert on `memberRole`.
  mockGetActiveMember.mockReset();
  mockGetActiveMember.mockResolvedValue({ data: null, error: null });
});

describe('useDashboardShell', () => {
  it('reports isLoading=true while the session is pending (loading)', () => {
    sessionState.isPending = true;
    const { result } = renderHookWithProviders(() => useDashboardShell());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.activeOrg).toBeNull();
  });

  it('returns activeOrg=null and isLoading=false when there is no active organization (empty)', () => {
    sessionState.data = { session: {} };
    const { result } = renderHookWithProviders(() => useDashboardShell());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.activeOrg).toBeNull();
    expect(result.current.needsTosAcceptance).toBe(false);
  });

  it('populates activeOrg + flags ToS accepted on success', async () => {
    sessionState.data = {
      session: { token: 'tok-1', activeOrganizationId: 'org-1' },
    };
    mockGetActiveMember.mockResolvedValue({
      data: { id: 'mem-1', role: 'admin' },
      error: null,
    });
    setTRPCMock({
      'organization.getCurrent': () => ({
        id: 'org-1',
        name: 'Acme',
        slug: 'acme',
        logo: null,
      }),
      'consent.hasAcceptedToS': () => ({ accepted: true }),
    });
    const { result } = renderHookWithProviders(() => useDashboardShell());
    await waitFor(() => expect(result.current.activeOrg?.id).toBe('org-1'));
    await waitFor(() => expect(result.current.memberRole).toBe('admin'));
    expect(result.current.needsTosAcceptance).toBe(false);
  });

  it('marks needsTosAcceptance=true when ToS query resolves with accepted=false', async () => {
    sessionState.data = { session: { activeOrganizationId: 'org-1' } };
    setTRPCMock({
      'organization.getCurrent': () => ({
        id: 'org-1',
        name: 'Acme',
        slug: 'acme',
        logo: null,
      }),
      'consent.hasAcceptedToS': () => ({ accepted: false }),
    });
    const { result } = renderHookWithProviders(() => useDashboardShell());
    await waitFor(() => expect(result.current.needsTosAcceptance).toBe(true));
  });
});
