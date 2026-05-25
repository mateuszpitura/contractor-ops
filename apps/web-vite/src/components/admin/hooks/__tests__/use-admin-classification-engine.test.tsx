/**
 * `useAdminClassificationEngine` — covers the kill-switch / registry derivation:
 *   - flag enabled vs disabled
 *   - pendingCount / totalCount projection
 *   - isOverridden = !flag && pending
 *   - row mapping (missing entry, pending entry, approved entry)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const useFlagMock = vi.fn();
const getRegistryMock = vi.fn();
const getAllPendingMock = vi.fn();
const LOCKED_DISCLAIMERS_MOCK: Record<string, string> = {};

vi.mock('../../../layout/feature-flag-context.js', () => ({
  useFlag: (key: string) => useFlagMock(key),
}));

vi.mock('@contractor-ops/validators', () => ({
  getRegistry: () => getRegistryMock(),
  getAllPending: () => getAllPendingMock(),
  // biome-ignore lint/style/useNamingConvention: re-exporting an upstream constant
  get LOCKED_DISCLAIMERS() {
    return LOCKED_DISCLAIMERS_MOCK;
  },
}));

import { renderHookWithProviders } from '../../../../test-utils/render-hook.js';
import { useAdminClassificationEngine } from '../use-admin-classification-engine.js';

function setKeys(keys: string[]) {
  for (const k of Object.keys(LOCKED_DISCLAIMERS_MOCK)) delete LOCKED_DISCLAIMERS_MOCK[k];
  for (const k of keys) LOCKED_DISCLAIMERS_MOCK[k] = k;
}

beforeEach(() => {
  useFlagMock.mockReset();
  getRegistryMock.mockReset();
  getAllPendingMock.mockReset();
});

describe('useAdminClassificationEngine', () => {
  it('reports flagEnabled=true and no override when all keys are approved', () => {
    useFlagMock.mockReturnValue(true);
    setKeys(['key.a', 'key.b']);
    getRegistryMock.mockReturnValue({
      'key.a': {
        status: 'APPROVED',
        approvedBy: 'Mary',
        approvedAt: '2024-08-01',
        approverRole: 'legal',
      },
      'key.b': {
        status: 'APPROVED',
        approvedBy: 'Jane',
        approvedAt: '2024-08-02',
        approverRole: 'legal',
      },
    });
    getAllPendingMock.mockReturnValue([]);

    const { result } = renderHookWithProviders(() => useAdminClassificationEngine());

    expect(result.current.flagEnabled).toBe(true);
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.totalCount).toBe(2);
    expect(result.current.isOverridden).toBe(false);
    expect(result.current.rows).toHaveLength(2);
    expect(result.current.rows[0]).toMatchObject({
      key: 'key.a',
      status: 'APPROVED',
      approvedBy: 'Mary',
      isPending: false,
    });
  });

  it('flips isOverridden when the flag is disabled but pending keys exist', () => {
    useFlagMock.mockReturnValue(false);
    setKeys(['key.a']);
    getRegistryMock.mockReturnValue({
      'key.a': { status: 'PENDING', approvedBy: null, approvedAt: null, approverRole: null },
    });
    getAllPendingMock.mockReturnValue(['key.a']);

    const { result } = renderHookWithProviders(() => useAdminClassificationEngine());

    expect(result.current.flagEnabled).toBe(false);
    expect(result.current.isOverridden).toBe(true);
    expect(result.current.rows[0]).toMatchObject({
      status: 'PENDING',
      isPending: true,
      approvedBy: null,
    });
  });

  it('marks missing registry entries as MISSING + isPending', () => {
    useFlagMock.mockReturnValue(true);
    setKeys(['key.missing']);
    getRegistryMock.mockReturnValue({});
    getAllPendingMock.mockReturnValue([]);

    const { result } = renderHookWithProviders(() => useAdminClassificationEngine());

    expect(result.current.rows[0]).toMatchObject({
      key: 'key.missing',
      status: 'MISSING',
      isPending: true,
      approvedBy: null,
    });
  });

  it('does not flag override when flag is disabled but no keys are pending', () => {
    useFlagMock.mockReturnValue(false);
    setKeys(['key.a']);
    getRegistryMock.mockReturnValue({
      'key.a': { status: 'APPROVED', approvedBy: 'x', approvedAt: 'y', approverRole: 'z' },
    });
    getAllPendingMock.mockReturnValue([]);

    const { result } = renderHookWithProviders(() => useAdminClassificationEngine());

    expect(result.current.isOverridden).toBe(false);
  });
});
