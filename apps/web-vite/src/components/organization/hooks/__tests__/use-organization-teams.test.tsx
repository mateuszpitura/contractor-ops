/**
 * Hook spec for `useOrganizationTeams` — drives the teams tab list with
 * search, sheet open/edit state, plus an error-path `refetch`. Mirrors
 * the cost-centers shape; isError/refetch are surfaced for the explicit
 * error UI in `TeamTable`.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useOrganizationTeams } from '../use-organization-teams.js';

const trpcProxy = createTRPCProxy();

const sampleTeam = {
  id: 't1',
  name: 'Platform',
  code: 'PLAT',
  managerUserId: null,
  fallbackApproverId: null,
  status: 'ACTIVE' as const,
  source: 'MANUAL' as const,
  externalId: null,
  updatedAt: new Date('2026-05-01T10:00:00Z'),
};

describe('useOrganizationTeams', () => {
  it('starts loading with empty defaults', () => {
    setTRPCMock({
      'organizationDefinitions.team.list': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useOrganizationTeams());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(result.current.rows).toEqual([]);
    expect(result.current.search).toBe('');
    expect(result.current.editing).toBeNull();
    expect(result.current.sheetOpen).toBe(false);
  });

  it('returns empty rows on resolved-empty list', async () => {
    setTRPCMock({
      'organizationDefinitions.team.list': () => ({ items: [] }),
    });
    const { result } = renderHookWithProviders(() => useOrganizationTeams());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows).toEqual([]);
    expect(result.current.isError).toBe(false);
  });

  it('returns mapped rows on success', async () => {
    setTRPCMock({
      'organizationDefinitions.team.list': () => ({ items: [sampleTeam] }),
    });
    const { result } = renderHookWithProviders(() => useOrganizationTeams());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0]?.id).toBe('t1');
  });

  it('flips isError true on query failure and surfaces refetch', async () => {
    setTRPCMock({
      'organizationDefinitions.team.list': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useOrganizationTeams());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(typeof result.current.refetch).toBe('function');
    expect(result.current.rows).toEqual([]);
  });

  it('setters update local state (search / sheet / editing)', () => {
    setTRPCMock({
      'organizationDefinitions.team.list': () => ({ items: [] }),
    });
    const { result } = renderHookWithProviders(() => useOrganizationTeams());
    act(() => result.current.setSearch('plat'));
    expect(result.current.search).toBe('plat');
    act(() => result.current.setSheetOpen(true));
    expect(result.current.sheetOpen).toBe(true);
    act(() =>
      result.current.setEditing({
        id: 't9',
        name: 'X',
        code: null,
        managerUserId: null,
        fallbackApproverId: null,
      }),
    );
    expect(result.current.editing?.id).toBe('t9');
  });
});
