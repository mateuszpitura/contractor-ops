/**
 * `useContractActivityTab` — pure derivation hook for the contract
 * detail "Activity" tab timeline. Covers:
 *   - empty timeline when only the creation event matches (1 event)
 *   - empty-state flag stays false because creation always emits at least one row
 *   - amendments + status change + document upload events sort newest-first
 *   - formatRelativeTime renders "just now" / "Nm ago" / "Nh ago" / "Nd ago"
 *   - >30 day fallback hands off to formatDate
 */

import { describe, expect, it } from 'vitest';

import { renderHookWithProviders } from '../../../../test-utils/render-hook.js';
import { useContractActivityTab } from '../use-contract-activity-tab.js';

const baseContract = {
  id: 'ct-1',
  status: 'ACTIVE',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  amendments: [] as Array<{ id: string; title: string; createdAt: string | Date }>,
};

describe('useContractActivityTab', () => {
  it('emits a single "contract created" event when there is no other activity (success, minimal payload)', () => {
    const { result } = renderHookWithProviders(() => useContractActivityTab(baseContract));
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0]?.key).toBe('created-ct-1');
    expect(result.current.isEmpty).toBe(false);
  });

  it('adds a status-change event when updatedAt diverges from createdAt by >1min', () => {
    const { result } = renderHookWithProviders(() =>
      useContractActivityTab({
        ...baseContract,
        updatedAt: '2025-01-02T00:00:00Z',
      }),
    );
    const keys = result.current.events.map(e => e.key);
    expect(keys).toContain('status-ct-1');
  });

  it('emits an event per amendment and sorts the timeline newest-first', () => {
    const { result } = renderHookWithProviders(() =>
      useContractActivityTab({
        ...baseContract,
        amendments: [
          { id: 'a-old', title: 'Older', createdAt: '2025-01-15T00:00:00Z' },
          { id: 'a-new', title: 'Newer', createdAt: '2025-03-15T00:00:00Z' },
        ],
      }),
    );
    const keys = result.current.events.map(e => e.key);
    expect(keys[0]).toBe('amendment-a-new');
    expect(keys).toContain('amendment-a-old');
  });

  it('adds a documents-uploaded event when documentCount > 0', () => {
    const { result } = renderHookWithProviders(() =>
      useContractActivityTab({
        ...baseContract,
        updatedAt: '2025-02-01T00:00:00Z',
        documentCount: 3,
      }),
    );
    const keys = result.current.events.map(e => e.key);
    expect(keys).toContain('documents-ct-1');
  });

  it('formatRelativeTime returns "just now" for the current moment (success, short delta)', () => {
    const { result } = renderHookWithProviders(() => useContractActivityTab(baseContract));
    expect(result.current.formatRelativeTime(new Date())).toBe('just now');
  });

  it('formatRelativeTime returns "Nd ago" / "Nh ago" / "Nm ago" for sub-30-day deltas', () => {
    const { result } = renderHookWithProviders(() => useContractActivityTab(baseContract));
    const now = Date.now();
    expect(result.current.formatRelativeTime(new Date(now - 5 * 60_000))).toBe('5m ago');
    expect(result.current.formatRelativeTime(new Date(now - 2 * 60 * 60_000))).toBe('2h ago');
    expect(result.current.formatRelativeTime(new Date(now - 3 * 24 * 60 * 60_000))).toBe('3d ago');
  });

  it('formatRelativeTime falls back to a formatted absolute date past 30 days', () => {
    const { result } = renderHookWithProviders(() => useContractActivityTab(baseContract));
    const long = new Date(Date.now() - 60 * 24 * 60 * 60_000);
    const value = result.current.formatRelativeTime(long);
    expect(value).not.toBe('just now');
    expect(value).not.toContain('ago');
  });
});
