import { describe, expect, it, vi } from 'vitest';

import {
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from './_render-hook.js';

vi.mock('../../../../providers/trpc-provider.js', () => {
  const trpc = createTRPCProxy();
  return { useTRPC: () => trpc, usePortalTRPC: () => trpc };
});

const { useJiraActivitySummary } = await import('../use-jira-activity-summary.js');

describe('useJiraActivitySummary', () => {
  it('loading: query pending', () => {
    setTRPCMock({ 'jira.recentActivity': () => new Promise(() => undefined) });
    const { result } = renderHookWithProviders(() => useJiraActivitySummary('c1'));
    expect(result.current.activityQuery.isLoading).toBe(true);
    expect(result.current.items).toEqual([]);
    clearTRPCMock();
  });

  it('empty: resolves to []', async () => {
    setTRPCMock({ 'jira.recentActivity': () => [] });
    const { result } = renderHookWithProviders(() => useJiraActivitySummary('c1'));
    await waitFor(() => expect(result.current.activityQuery.isLoading).toBe(false));
    expect(result.current.items).toEqual([]);
    clearTRPCMock();
  });

  it('error: keeps items as []', async () => {
    setTRPCMock({
      'jira.recentActivity': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useJiraActivitySummary('c1'));
    await waitFor(() => expect(result.current.activityQuery.isError).toBe(true));
    expect(result.current.items).toEqual([]);
    clearTRPCMock();
  });

  it('success: exposes items and a relativeTime formatter', async () => {
    const fixture = [
      {
        id: 'a1',
        externalId: 'JIRA-1',
        externalUrl: 'https://example.atlassian.net/browse/JIRA-1',
        metadataJson: {
          key: 'JIRA-1',
          summary: 'Fix bug',
          status: 'In Progress',
          statusCategory: 'indeterminate' as const,
          url: 'https://example.atlassian.net/browse/JIRA-1',
        },
        updatedAt: new Date(Date.now() - 30 * 1000).toISOString(),
      },
    ];
    setTRPCMock({ 'jira.recentActivity': () => fixture });
    const { result } = renderHookWithProviders(() => useJiraActivitySummary('c1'));
    await waitFor(() => expect(result.current.activityQuery.isLoading).toBe(false));
    expect(result.current.items).toEqual(fixture);
    const recent = result.current.relativeTime(fixture[0]!.updatedAt);
    expect(typeof recent).toBe('string');
    expect(recent.length).toBeGreaterThan(0);
    clearTRPCMock();
  });
});
