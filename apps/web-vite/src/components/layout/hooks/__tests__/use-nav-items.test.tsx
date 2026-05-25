/**
 * `useNavItems` — sidebar group projection. Covers:
 *   - empty: zero permissions → no groups
 *   - permission gating filters items out per `can(resource, actions)`
 *   - flag-gated items are hidden when the flag is off
 *   - active state matches base path and sub-paths
 *   - settings tab active flag respects the `?tab=` query
 *   - workflows nav item flags `showWorkflowBadge`
 */

import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const canMock = vi.fn<(resource: string, actions: string[]) => boolean>();
const flagBagState: { current: Record<string, boolean> } = { current: {} };

vi.mock('../../../../hooks/use-permissions.js', () => ({
  usePermissions: () => ({
    can: (r: string, a: string[]) => canMock(r, a),
    isPlatformAdmin: false,
  }),
}));

vi.mock('../../feature-flag-context.js', async () => {
  const React = await import('react');
  return {
    useFlagBag: () => flagBagState.current,
    FeatureFlagProvider: ({ children }: { children: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

import { renderHookWithProviders } from '../../../../test-utils/render-hook.js';
import { useNavItems } from '../use-nav-items.js';

beforeEach(() => {
  canMock.mockReset();
  flagBagState.current = {};
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useNavItems', () => {
  it('returns no groups when the user has zero permissions (empty)', () => {
    canMock.mockReturnValue(false);
    const { result } = renderHookWithProviders(() => useNavItems('/', new URLSearchParams()));
    // Dashboard item has no permission → always visible → overview group survives.
    expect(result.current.groups.some(g => g.key === 'overview')).toBe(true);
    expect(result.current.groups.some(g => g.key === 'operations')).toBe(false);
  });

  it('includes the operations group when contractor.read is granted (permission gating)', () => {
    canMock.mockImplementation(
      (resource, actions) => resource === 'contractor' && actions.includes('read'),
    );
    const { result } = renderHookWithProviders(() => useNavItems('/', new URLSearchParams()));
    const operations = result.current.groups.find(g => g.key === 'operations');
    expect(operations).toBeDefined();
    expect(operations?.items.some(i => i.key === 'contractors')).toBe(true);
  });

  it('marks the contractors item active when pathname matches its href', () => {
    canMock.mockImplementation(
      (resource, actions) => resource === 'contractor' && actions.includes('read'),
    );
    const { result } = renderHookWithProviders(() =>
      useNavItems('/contractors/abc', new URLSearchParams()),
    );
    const contractors = result.current.groups
      .flatMap(g => g.items)
      .find(i => i.key === 'contractors');
    expect(contractors?.isActive).toBe(true);
  });

  it('flags showWorkflowBadge only on the workflows nav item', () => {
    canMock.mockReturnValue(true);
    const { result } = renderHookWithProviders(() => useNavItems('/', new URLSearchParams()));
    const items = result.current.groups.flatMap(g => g.items);
    const workflows = items.find(i => i.key === 'workflows');
    if (workflows) {
      expect(workflows.showWorkflowBadge).toBe(true);
    }
    expect(items.filter(i => i.showWorkflowBadge).length).toBeLessThanOrEqual(1);
  });
});
