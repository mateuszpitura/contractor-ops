/**
 * `useWorkflowTemplateDetail` — drives the template-detail container.
 * Covers: loading, not-found (success+null data), success, error (with retry).
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

vi.mock('../../layout/breadcrumb-context.js', () => ({
  useBreadcrumbOverride: () => undefined,
}));

vi.mock('../../../../providers/trpc-provider.js', () => {
  const trpc = createTRPCProxy();
  return { useTRPC: () => trpc, usePortalTRPC: () => trpc };
});

const { useWorkflowTemplateDetail } = await import('../use-workflow-template-detail.js');

const sampleTemplate = {
  id: 'tmpl-1',
  name: 'Onboarding',
  type: 'ONBOARDING',
  status: 'ACTIVE',
  description: '',
  tasks: [],
};

describe('useWorkflowTemplateDetail', () => {
  it('reports loading while the template query is pending', () => {
    setTRPCMock({
      'workflow.getTemplate': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useWorkflowTemplateDetail('tmpl-1'));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(result.current.isNotFound).toBe(false);
    expect(result.current.template).toBeUndefined();
    clearTRPCMock();
  });

  it('reports isNotFound when the API returns NOT_FOUND', async () => {
    setTRPCMock({
      'workflow.getTemplate': () => {
        const err = new Error('NOT_FOUND');
        Object.assign(err, { data: { code: 'NOT_FOUND' } });
        throw err;
      },
    });
    const { result } = renderHookWithProviders(() => useWorkflowTemplateDetail('missing'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isNotFound).toBe(true);
    clearTRPCMock();
  });

  it('surfaces the template on success', async () => {
    setTRPCMock({
      'workflow.getTemplate': () => sampleTemplate,
    });
    const { result } = renderHookWithProviders(() => useWorkflowTemplateDetail('tmpl-1'));
    await waitFor(() => expect(result.current.template).toEqual(sampleTemplate));
    expect(result.current.isNotFound).toBe(false);
    clearTRPCMock();
  });

  it('reports isError and handleRetry triggers a refetch', async () => {
    let calls = 0;
    setTRPCMock({
      'workflow.getTemplate': () => {
        calls += 1;
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useWorkflowTemplateDetail('tmpl-1'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    const before = calls;
    await act(async () => {
      result.current.handleRetry();
    });
    await waitFor(() => expect(calls).toBeGreaterThan(before));
    clearTRPCMock();
  });
});
