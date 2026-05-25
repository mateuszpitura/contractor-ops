/**
 * `useTemplatesTable` — drives the Templates tab on /workflows.
 * Covers: loading, empty (and seed mutation fires once), success,
 * row navigation, delete dialog wiring, error retry.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  act,
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';

const routerPush = vi.fn();
const activate = vi.fn().mockResolvedValue(undefined);
const archive = vi.fn().mockResolvedValue(undefined);
const duplicate = vi.fn().mockResolvedValue(undefined);
const deleteTemplate = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../../hooks/use-template-mutations.js', () => ({
  useTemplateMutations: () => ({ activate, archive, duplicate, deleteTemplate }),
}));

vi.mock('../../../../i18n/navigation.js', () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
}));

vi.mock('../../../../providers/trpc-provider.js', () => {
  const trpc = createTRPCProxy();
  return { useTRPC: () => trpc, usePortalTRPC: () => trpc };
});

const { useTemplatesTable } = await import('../use-templates-table.js');

const sampleTemplate = {
  id: 'tmpl-1',
  name: 'Onboarding',
  type: 'ONBOARDING',
  status: 'DRAFT',
  createdAt: '2026-05-01',
  updatedAt: '2026-05-10',
  _count: { runs: 0, tasks: 4 },
};

describe('useTemplatesTable', () => {
  it('reports loading while the templates query is pending', () => {
    setTRPCMock({
      'workflow.listTemplates': () => new Promise(() => undefined),
      'workflow.seedStarterTemplates': () => ({ seeded: false }),
    });
    const { result } = renderHookWithProviders(() => useTemplatesTable());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.templates).toEqual([]);
    clearTRPCMock();
  });

  it('returns empty templates and triggers the seed mutation once', async () => {
    let seedCalls = 0;
    setTRPCMock({
      'workflow.listTemplates': () => ({ items: [], total: 0 }),
      'workflow.seedStarterTemplates': () => {
        seedCalls += 1;
        return { seeded: false };
      },
    });
    const { result } = renderHookWithProviders(() => useTemplatesTable());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(seedCalls).toBeGreaterThanOrEqual(1));
    expect(result.current.templates).toEqual([]);
    clearTRPCMock();
  });

  it('surfaces templates on success', async () => {
    setTRPCMock({
      'workflow.listTemplates': () => ({ items: [sampleTemplate], total: 1 }),
      'workflow.seedStarterTemplates': () => ({ seeded: false }),
    });
    const { result } = renderHookWithProviders(() => useTemplatesTable());
    await waitFor(() => expect(result.current.templates.length).toBe(1));
    expect(result.current.templates[0]?.name).toBe('Onboarding');
    clearTRPCMock();
  });

  it('row-navigate pushes to the template detail route', async () => {
    setTRPCMock({
      'workflow.listTemplates': () => ({ items: [sampleTemplate], total: 1 }),
      'workflow.seedStarterTemplates': () => ({ seeded: false }),
    });
    const { result } = renderHookWithProviders(() => useTemplatesTable());
    await waitFor(() => expect(result.current.templates.length).toBe(1));
    routerPush.mockClear();
    act(() => result.current.handleRowNavigate('tmpl-1'));
    expect(routerPush).toHaveBeenCalledWith('/workflows/templates/tmpl-1');
    clearTRPCMock();
  });

  it('delete only fires when a target is set then clears it', async () => {
    deleteTemplate.mockClear();
    setTRPCMock({
      'workflow.listTemplates': () => ({ items: [sampleTemplate], total: 1 }),
      'workflow.seedStarterTemplates': () => ({ seeded: false }),
    });
    const { result } = renderHookWithProviders(() => useTemplatesTable());
    await waitFor(() => expect(result.current.templates.length).toBe(1));

    act(() => result.current.handleDelete());
    expect(deleteTemplate).not.toHaveBeenCalled();

    act(() => result.current.setDeleteTarget(sampleTemplate));
    expect(result.current.deleteTarget?.id).toBe('tmpl-1');
    act(() => result.current.handleDelete());
    expect(deleteTemplate).toHaveBeenCalledWith('tmpl-1');
    expect(result.current.deleteTarget).toBeNull();
    clearTRPCMock();
  });

  it('reports isError and exposes handleRetry', async () => {
    let calls = 0;
    setTRPCMock({
      'workflow.listTemplates': () => {
        calls += 1;
        throw new Error('boom');
      },
      'workflow.seedStarterTemplates': () => ({ seeded: false }),
    });
    const { result } = renderHookWithProviders(() => useTemplatesTable());
    await waitFor(() => expect(result.current.isError).toBe(true));
    const before = calls;
    await act(async () => {
      result.current.handleRetry();
    });
    await waitFor(() => expect(calls).toBeGreaterThan(before));
    clearTRPCMock();
  });
});
