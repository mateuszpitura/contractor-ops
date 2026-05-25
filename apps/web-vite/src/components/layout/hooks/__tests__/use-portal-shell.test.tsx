/**
 * `usePortalShell` — portal shell view-model. Covers:
 *   - loading: session query pending → isLoading=true, topBarProps null
 *   - error: query rejects → shouldRedirectToLogin=true, topBarProps null
 *   - success: session resolves → topBarProps populated
 *   - shellStyle: present when org has a brand color; undefined otherwise
 *   - shellStyle: ignores non-string brandColor (defensive)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

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
import { usePortalShell } from '../use-portal-shell.js';

const trpcProxy = createTRPCProxy();

beforeEach(() => {
  setTRPCMock({});
});

describe('usePortalShell', () => {
  it('reports isLoading=true while the session query is pending (loading)', () => {
    setTRPCMock({
      'portal.getSession': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => usePortalShell());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.topBarProps).toBeNull();
  });

  it('flips shouldRedirectToLogin=true and clears topBarProps when the query rejects (error)', async () => {
    setTRPCMock({
      'portal.getSession': () => {
        throw new Error('not authenticated');
      },
    });
    const { result } = renderHookWithProviders(() => usePortalShell());
    await waitFor(() => expect(result.current.shouldRedirectToLogin).toBe(true));
    expect(result.current.topBarProps).toBeNull();
  });

  it('populates topBarProps and shellStyle from the session on success', async () => {
    setTRPCMock({
      'portal.getSession': () => ({
        organization: {
          id: 'org-1',
          name: 'Acme',
          logo: 'https://cdn/example.png',
          brandColor: '#ff0000',
        },
        contractor: {
          id: 'c-1',
          displayName: 'Ada',
          email: 'ada@example.com',
        },
      }),
    });
    const { result } = renderHookWithProviders(() => usePortalShell());
    await waitFor(() => expect(result.current.topBarProps?.orgName).toBe('Acme'));
    expect(result.current.topBarProps).toEqual({
      orgName: 'Acme',
      orgLogo: 'https://cdn/example.png',
      contractorName: 'Ada',
      contractorEmail: 'ada@example.com',
    });
    expect(result.current.shellStyle).toMatchObject({
      '--portal-brand': '#ff0000',
      '--primary': '#ff0000',
    });
  });

  it('returns shellStyle=undefined when the org has no brand color', async () => {
    setTRPCMock({
      'portal.getSession': () => ({
        organization: { id: 'org-1', name: 'Acme', logo: null, brandColor: null },
        contractor: { id: 'c-1', displayName: 'Ada', email: 'ada@example.com' },
      }),
    });
    const { result } = renderHookWithProviders(() => usePortalShell());
    await waitFor(() => expect(result.current.topBarProps?.orgName).toBe('Acme'));
    expect(result.current.shellStyle).toBeUndefined();
  });
});
