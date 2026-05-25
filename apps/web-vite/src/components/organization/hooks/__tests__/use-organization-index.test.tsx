/**
 * Hook spec for `useOrganizationIndex` — drives the org summary cards
 * (teams / projects / cost-centers counts). Three independent list queries
 * resolve into a typed counts object; `total` wins over `nextCursor` and
 * falls back to `items.length` for a fully-paged response.
 */

import { describe, expect, it, vi } from 'vitest';

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
import { useOrganizationIndex } from '../use-organization-index.js';

const trpcProxy = createTRPCProxy();

describe('useOrganizationIndex', () => {
  it('returns undefined counts while all three queries are pending (loading)', () => {
    setTRPCMock({
      'organizationDefinitions.team.list': () => new Promise(() => undefined),
      'organizationDefinitions.project.list': () => new Promise(() => undefined),
      'organizationDefinitions.costCenter.list': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useOrganizationIndex());
    expect(result.current.teamsCount).toBeUndefined();
    expect(result.current.projectsCount).toBeUndefined();
    expect(result.current.costCentersCount).toBeUndefined();
  });

  it('returns 0 counts for empty result sets', async () => {
    setTRPCMock({
      'organizationDefinitions.team.list': () => ({ items: [], total: 0 }),
      'organizationDefinitions.project.list': () => ({ items: [], total: 0 }),
      'organizationDefinitions.costCenter.list': () => ({ items: [], total: 0 }),
    });
    const { result } = renderHookWithProviders(() => useOrganizationIndex());
    await waitFor(() => expect(result.current.teamsCount).toBe(0));
    expect(result.current.projectsCount).toBe(0);
    expect(result.current.costCentersCount).toBe(0);
  });

  it('returns total when present on the list payload', async () => {
    setTRPCMock({
      'organizationDefinitions.team.list': () => ({ items: [{ id: 't1' }], total: 7 }),
      'organizationDefinitions.project.list': () => ({ items: [{ id: 'p1' }], total: 12 }),
      'organizationDefinitions.costCenter.list': () => ({ items: [{ id: 'c1' }], total: 3 }),
    });
    const { result } = renderHookWithProviders(() => useOrganizationIndex());
    await waitFor(() => expect(result.current.teamsCount).toBe(7));
    expect(result.current.projectsCount).toBe(12);
    expect(result.current.costCentersCount).toBe(3);
  });

  it('falls back to items.length when total is absent and no nextCursor', async () => {
    setTRPCMock({
      'organizationDefinitions.team.list': () => ({ items: [{ id: 't1' }, { id: 't2' }] }),
      'organizationDefinitions.project.list': () => ({ items: [] }),
      'organizationDefinitions.costCenter.list': () => ({ items: [{ id: 'c1' }] }),
    });
    const { result } = renderHookWithProviders(() => useOrganizationIndex());
    await waitFor(() => expect(result.current.teamsCount).toBe(2));
    expect(result.current.projectsCount).toBe(0);
    expect(result.current.costCentersCount).toBe(1);
  });

  it('returns undefined count when nextCursor is set (truncated page)', async () => {
    setTRPCMock({
      'organizationDefinitions.team.list': () => ({
        items: [{ id: 't1' }],
        nextCursor: 'tok',
      }),
      'organizationDefinitions.project.list': () => ({ items: [], total: 0 }),
      'organizationDefinitions.costCenter.list': () => ({ items: [], total: 0 }),
    });
    const { result } = renderHookWithProviders(() => useOrganizationIndex());
    await waitFor(() => expect(result.current.projectsCount).toBe(0));
    expect(result.current.teamsCount).toBeUndefined();
  });

  it('keeps a count undefined when its query errors', async () => {
    setTRPCMock({
      'organizationDefinitions.team.list': () => {
        throw new Error('boom');
      },
      'organizationDefinitions.project.list': () => ({ items: [], total: 4 }),
      'organizationDefinitions.costCenter.list': () => ({ items: [], total: 2 }),
    });
    const { result } = renderHookWithProviders(() => useOrganizationIndex());
    await waitFor(() => expect(result.current.projectsCount).toBe(4));
    expect(result.current.teamsCount).toBeUndefined();
    expect(result.current.costCentersCount).toBe(2);
  });
});
