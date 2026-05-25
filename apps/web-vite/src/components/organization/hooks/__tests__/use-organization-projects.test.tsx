/**
 * Hook spec for `useOrganizationProjects` — drives the projects tab.
 * Composes four tRPC calls: project.list, team.list (for name lookup),
 * project.listSyncableConnections, project.sync (mutation). The sync
 * mutation must emit a success toast and invalidate both the project
 * list and the pending-merges inbox.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useOrganizationProjects } from '../use-organization-projects.js';

const trpcProxy = createTRPCProxy();

const sampleProject = {
  id: 'p1',
  name: 'Migration',
  code: 'MIG',
  teamId: 't1',
  startDate: null,
  endDate: null,
  budgetMinor: 1_000_000,
  budgetCurrency: 'EUR',
  status: 'ACTIVE' as const,
  source: 'MANUAL' as const,
  externalId: null,
  updatedAt: new Date('2026-05-01T10:00:00Z'),
};
const sampleTeam = { id: 't1', name: 'Platform' };

describe('useOrganizationProjects', () => {
  it('starts in loading state with empty derived state', () => {
    setTRPCMock({
      'organizationDefinitions.project.list': () => new Promise(() => undefined),
      'organizationDefinitions.team.list': () => new Promise(() => undefined),
      'organizationDefinitions.project.listSyncableConnections': () => [],
    });
    const { result } = renderHookWithProviders(() => useOrganizationProjects());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.rows).toEqual([]);
    expect(result.current.teamNamesById).toEqual({});
    expect(result.current.connections).toEqual([]);
  });

  it('renders empty rows + empty connections on resolved-empty payloads', async () => {
    setTRPCMock({
      'organizationDefinitions.project.list': () => ({ items: [] }),
      'organizationDefinitions.team.list': () => ({ items: [] }),
      'organizationDefinitions.project.listSyncableConnections': () => [],
    });
    const { result } = renderHookWithProviders(() => useOrganizationProjects());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows).toEqual([]);
    expect(result.current.connections).toEqual([]);
  });

  it('maps list + teams into rows and lookup table on success', async () => {
    setTRPCMock({
      'organizationDefinitions.project.list': () => ({ items: [sampleProject] }),
      'organizationDefinitions.team.list': () => ({ items: [sampleTeam] }),
      'organizationDefinitions.project.listSyncableConnections': () => [
        { id: 'conn1', provider: 'jira' },
      ],
    });
    const { result } = renderHookWithProviders(() => useOrganizationProjects());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.teamNamesById).toEqual({ t1: 'Platform' });
    expect(result.current.connections).toEqual([{ id: 'conn1', provider: 'jira' }]);
  });

  it('rows stay empty when the list query errors', async () => {
    setTRPCMock({
      'organizationDefinitions.project.list': () => {
        throw new Error('boom');
      },
      'organizationDefinitions.team.list': () => ({ items: [] }),
      'organizationDefinitions.project.listSyncableConnections': () => [],
    });
    const { result } = renderHookWithProviders(() => useOrganizationProjects());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows).toEqual([]);
  });

  it('syncMutation emits success toast on resolved sync', async () => {
    toastSuccess.mockClear();
    setTRPCMock({
      'organizationDefinitions.project.list': () => ({ items: [] }),
      'organizationDefinitions.team.list': () => ({ items: [] }),
      'organizationDefinitions.project.listSyncableConnections': () => [
        { id: 'conn1', provider: 'jira' },
      ],
      'organizationDefinitions.project.sync': () => ({
        inserted: 3,
        linked: 1,
        pending: 0,
      }),
    });
    const { result } = renderHookWithProviders(() => useOrganizationProjects());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => {
      result.current.syncMutation.mutate({ connectionId: 'conn1' });
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(toastSuccess.mock.calls[0]?.[0]).toContain('Sync complete');
  });

  it('syncMutation emits error toast on failure', async () => {
    toastError.mockClear();
    setTRPCMock({
      'organizationDefinitions.project.list': () => ({ items: [] }),
      'organizationDefinitions.team.list': () => ({ items: [] }),
      'organizationDefinitions.project.listSyncableConnections': () => [
        { id: 'conn1', provider: 'jira' },
      ],
      'organizationDefinitions.project.sync': () => {
        throw new Error('rate limit');
      },
    });
    const { result } = renderHookWithProviders(() => useOrganizationProjects());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => {
      result.current.syncMutation.mutate({ connectionId: 'conn1' });
    });
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0]?.[0]).toContain('rate limit');
  });
});
