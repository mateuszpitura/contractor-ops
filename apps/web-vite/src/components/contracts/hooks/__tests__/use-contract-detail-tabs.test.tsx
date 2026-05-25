/**
 * `useContractDetailTabs` — `?tab=` URL state + Linear taskRunIds
 * derivation for the contract detail view. Covers:
 *   - default tab is 'overview' when the URL has no `?tab=`
 *   - setTab persists into nuqs (next render reflects it via re-render)
 *   - taskRunIds is empty when no workflow runs are attached (empty data)
 *   - taskRunIds collects unique ids across runs + tasks (success)
 *   - missing workflowRuns / malformed payload yields [] (error-resilient)
 */

import { describe, expect, it } from 'vitest';

import { act, renderHookWithProviders } from '../../../../test-utils/render-hook.js';
import { useContractDetailTabs } from '../use-contract-detail-tabs.js';

// Loose stand-in for the inferred AppRouter ContractDetail; the hook only
// reaches for `workflowRuns` so the rest is irrelevant here.
const baseContract = {
  id: 'ct-1',
  workflowRuns: [],
} as unknown as Parameters<typeof useContractDetailTabs>[0];

describe('useContractDetailTabs', () => {
  it('defaults to the "overview" tab when no ?tab= param is present (loading-ish default)', () => {
    const { result } = renderHookWithProviders(() => useContractDetailTabs(baseContract));
    expect(result.current.currentTab).toBe('overview');
  });

  it('setTab updates the URL state and re-renders with the new tab (success)', () => {
    const { result } = renderHookWithProviders(() => useContractDetailTabs(baseContract));
    act(() => {
      result.current.setTab('documents');
    });
    expect(result.current.currentTab).toBe('documents');
  });

  it('returns an empty taskRunIds list when no workflowRuns are attached (empty)', () => {
    const { result } = renderHookWithProviders(() => useContractDetailTabs(baseContract));
    expect(result.current.taskRunIds).toEqual([]);
  });

  it('collects taskRunIds from every run/task pair (success path)', () => {
    const contract = {
      id: 'ct-1',
      workflowRuns: [
        { tasks: [{ id: 'task-a' }, { id: 'task-b' }] },
        { tasks: [{ id: 'task-c' }] },
      ],
    } as unknown as Parameters<typeof useContractDetailTabs>[0];

    const { result } = renderHookWithProviders(() => useContractDetailTabs(contract));
    expect(result.current.taskRunIds).toEqual(['task-a', 'task-b', 'task-c']);
  });

  it('returns [] when workflowRuns is missing or malformed (error-resilient guard)', () => {
    const contract = { id: 'ct-1' } as unknown as Parameters<typeof useContractDetailTabs>[0];
    const { result } = renderHookWithProviders(() => useContractDetailTabs(contract));
    expect(result.current.taskRunIds).toEqual([]);
  });
});
